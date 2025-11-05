// prompt.js
const OpenAI = require("openai");
const axios = require("axios");

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const REST_API_KEY = process.env.KAKAO_REST_API_KEY;

async function searchPlace(query) {
  if (!query) return null;
  try {
    const res = await axios.get(
      "https://dapi.kakao.com/v2/local/search/keyword.json",
      {
        params: { query },
        headers: { Authorization: `KakaoAK ${REST_API_KEY}` },
      }
    );

    if (!res.data.documents || res.data.documents.length === 0) return null;

    const doc = res.data.documents[0];
    return {
      name: doc.place_name,
      address: doc.address_name,
      longitude: parseFloat(doc.x),
      latitude: parseFloat(doc.y),
    };
  } catch (err) {
    console.error("카카오 API 오류:", err.response?.data || err.message);
    return null;
  }
}

async function gptPromptJson(text) {
  const res = await openai.chat.completions.create({
    model: "gpt-4.1-nano",
    messages: [
      {
        role: "system",
        content: `
너는 사용자의 문장에서 요양시설 검색 조건만 추출하는 JSON 파서이다.
오직 JSON만 반환해야 하며, 설명 문장이나 텍스트를 출력하지 않는다.

JSON 구조는 다음과 같다:
{
  "facility_kind": "요양병원" | "요양원" | "주간보호센터" | null,
  "location": {
    "sido": string | null,
    "sggu": string | null,
    "dong": string | null,
    "near_me": boolean,
    "coords": {
      "name": string | null,
      "address": string | null,
      "latitude": number | null,
      "longitude": number | null
    }
  },
  "conditions": { 
    "max_patients": number | null,
    "min_patients": number | null,
    "newly_established": boolean    
  },
  "staff_conditions": {
    "total_doctor": { "required": boolean|false , "min": number | null, "max": number | null, "exact": number | null },
    "medc_doctor": { "required": boolean|false , "min": number | null, "max": number | null, "exact": number | null },
    "dent_doctor": { "required": boolean|false , "min": number | null, "max": number | null, "exact": number | null },
    "hb_doctor": { "required": boolean|false , "min": number | null, "max": number | null, "exact": number | null },
    "specialist_required": boolean|false 
  }
}
`,
      },
      { role: "user", content: text },
    ],
    response_format: { type: "json_object" },
  });

  const filter = JSON.parse(res.choices[0].message.content);

  // “내 근처 / 주변” 문장일 때 처리
  const isNearMeSearch = /근처|주변/.test(text);
  if (isNearMeSearch) {
    filter.location.sido = null;
    filter.location.sggu = null;
    filter.location.dong = null;

    const searchQueryMatch = text.match(/([가-힣0-9]+)(?=\s*근처|\s*주변)/);
    const searchQuery = searchQueryMatch ? searchQueryMatch[1] : text;

    filter.location.coords = await searchPlace(searchQuery);
  }

  return filter;
}

module.exports = { gptPromptJson };
