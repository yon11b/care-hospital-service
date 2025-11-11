const models = require('../../models');
const sha256 = require('sha256');
const app = require('../../app');
const Sequelize = require('sequelize');
const AWS = require('aws-sdk');
const { Op } = require('sequelize');
const axios = require("axios");
const xml2js = require("xml2js");

// 최신 노인질환 관련 특강(세미나) 정보 크롤링 파일
const API_KEY = process.env.SEOUL_API_KEY;

// 필터링 키워드
const keywords = [
  // 주요 대상
  "어르신", "노인", "고령자", "시니어", "장년층", "은퇴자", "중장년", "갱년기",

  // 질병 및 건강 관련
  "치매", "알츠하이머", "파킨슨", "뇌졸중",
  "암", "암 예방", "암 검진", "고혈압", "당뇨", "심혈관", "만성질환",

  // 돌봄 및 요양
  "요양", "요양원", "요양보호사", "돌봄", "간병", "방문간호",
  "재활", "물리치료", "작업치료", "인지치료",

  // 노인복지/지원
  "복지관", "노인복지", "경로당", "노인종합복지관",
  "노후", "건강관리", "건강증진", "자세교정", "낙상예방",

  // 교육·강좌 (노인 관련만)
  "노인교육", "치매교육", "요양교육", "돌봄교육", "재활교육",
  "건강특강", "시니어강좌", "요양세미나", "노인세미나",

  // 프로그램/상담 (요양 중심)
  "치매상담", "건강상담", "요양상담", "복지상담",
  "인지프로그램", "재활프로그램", "운동프로그램",
  "요양프로그램", "치매프로그램",
];
const excludeKeywords = [
  "어린이", "아동", "청소년", "유아", "학생", "청년",
  "임산부", "부모", "보육", "출산", "여성", "영유아",
  "직장인", "청년층", "미성년", "학부모", "학교",
  "의료기관", "약국", "채용", "기간제근로자", "별관", "입찰", "영양사", "공무원",
  "동물", "임신", "자궁경부암", "합격자",
];

const apis = [
  {
    url: `http://openapi.seoul.go.kr:8088/${API_KEY}/xml/DongjakHealthNoticeList/1/200/`,
    source: "동작구보건소",
    titleKey: "SUBJECT",
    contentKey: "NTTCN",
    dateKey: "REGDATE",
  },
  {
    url: `http://openapi.seoul.go.kr:8088/${API_KEY}/xml/YcPbhlthNews/1/200/`,
    source: "양천구보건소",
    titleKey: "BBS_TITLE",
    contentKey: "BBS_CONTS",
    dateKey: "BBS_REG_DT",
  },  
  {
    url: `http://openapi.seoul.go.kr:8088/${API_KEY}/xml/GwanakHealthNewsList/1/200/`,
    source: "관악구보건소",
    titleKey: "TITLE",
    contentKey: "CONTENT",
    dateKey: "WRITEDAY",
  },     
  {
    url: `http://openapi.seoul.go.kr:8088/${API_KEY}/xml/EpBoardViewPbhlthNt/1/200/`,
    source: "은평구보건소",
    titleKey: "NTT_SJ",
    contentKey: "NTT_CN",
    dateKey: "FRST_REGISTER_PNTTM",
  },
  {
    url: `http://openapi.seoul.go.kr:8088/${API_KEY}/xml/SbChcNotice/1/200/`,
    source: "성북구보건소",
    titleKey: "TITLE",
    contentKey: "CONTENT",
    dateKey: "REG_DATE",
  },  
  {
    url: `http://openapi.seoul.go.kr:8088/${API_KEY}/xml/GsPbhlthNotice/1/200/`,
    source: "강서구보건소",
    titleKey: "TITLE",
    contentKey: "B_NOTE",
    dateKey: "I_DATE",
  },
  {
    url: `http://openapi.seoul.go.kr:8088/${API_KEY}/xml/NowonHealthNoticeList/1/200/`,
    source: "노원구보건소",
    titleKey: "TITLE",
    contentKey: "DESCRIPTION",
    dateKey: "PUBDATE",
    link: "LINK",
  },
  {
    url: `http://openapi.seoul.go.kr:8088/${API_KEY}/xml/SeochoNewsHealthNoticeList/1/200/`,
    source: "서초구보건소",
    titleKey: "TITLE",
    contentKey: "DESCRIPTION",
    dateKey: "PUBDATE",
    link: "LINK",
  },       
  {
    url: `http://openapi.seoul.go.kr:8088/${API_KEY}/xml/SeongdongNewsHealthNoticeList/1/200/`,
    source: "성동구보건소",
    titleKey: "subject",
    contentKey: "description",
    dateKey: "pubDate",
    link: "linkUrl",
  },
  {
    url: `http://openapi.seoul.go.kr:8088/${API_KEY}/xml/DdmHealthNoticeList/1/200/`,
    source: "동대문구보건소",
    titleKey: "subject",
    // contentKey: , 내용이 없음
    dateKey: "pubDate",
    link: "linkUrl",
  },         
];

async function parseXML(xml) {
  try {
    const parser = new xml2js.Parser({ explicitArray: false });
    return await parser.parseStringPromise(xml);
  } catch (err) {
    console.error("XML 파싱 실패:", err.message);
    return null;
  }
}

function normalizeText(text) {
  return text.replace(/\s+/g, '').replace(/[^\w가-힣]/g, '');
}

function containsKeyword(text) {
  if (!text) return false;
  const normalized = normalizeText(text);

  // 제외 키워드
  if (excludeKeywords.some(keyword => normalized.includes(keyword))) 
    return false;

  // 포함 키워드
  return keywords.some(keyword => normalized.includes(keyword));
}

function parseDate(dateStr) {
  if (!dateStr) return null;

  // YYYY-MM-DD or YYYY-MM-DD hh:mm:ss
  if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) {
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? null : d;
  }

  // YYYY.MM.DD
  if (/^\d{4}\.\d{2}\.\d{2}$/.test(dateStr)) {
    const d = new Date(dateStr.replace(/\./g, '-'));
    return isNaN(d.getTime()) ? null : d;
  }

  // YYYYMMDDhhmmss
  if (/^\d{14}$/.test(dateStr)) {
    const y = parseInt(dateStr.slice(0, 4), 10);
    const m = parseInt(dateStr.slice(4, 6), 10) - 1;
    const d = parseInt(dateStr.slice(6, 8), 10);
    const h = parseInt(dateStr.slice(8, 10), 10);
    const min = parseInt(dateStr.slice(10, 12), 10);
    const s = parseInt(dateStr.slice(12, 14), 10);
    return new Date(y, m, d, h, min, s);
  }

  // YYYYMMDD (시간 없음)
  if (/^\d{8}$/.test(dateStr)) {
    const y = parseInt(dateStr.slice(0, 4), 10);
    const m = parseInt(dateStr.slice(4, 6), 10) - 1;
    const d = parseInt(dateStr.slice(6, 8), 10);
    return new Date(y, m, d);
  }

  return null; // 변환 실패
}

async function fetchAndSave() {
  for (const api of apis) {
    try {
      const res = await axios.get(api.url);
      const parsed = await parseXML(res.data);
      if (!parsed) {
        console.log(`${api.source}: XML 파싱 실패`);
        continue;
      }

      const rootKey = Object.keys(parsed)[0];
      const rows = parsed[rootKey]?.row;
      if (!rows) {
        console.log(`${api.source}: 데이터 없음`);
        continue;
      }

      const list = Array.isArray(rows) ? rows : [rows];
      let savedCount = 0;

      for (const item of list) {
        const title = item[api.titleKey] || "";
        const content = item[api.contentKey] || null;
        const link = item[api.link] || null;

        if (!containsKeyword(title)) continue; // 제목만

        const createdAt = parseDate(item[api.dateKey]);
        if (!createdAt) continue; // 날짜 파싱 실패

        // 2025년 1월 1일 이후만 저장
        const startDate = new Date('2025-01-01');
        if (createdAt < startDate) continue;

        const where = { source: api.source, title };
        if (item[api.dateKey]) {
          where.created_at_api = parseDate(item[api.dateKey]);
        }

        const exists = await models.healthNews.findOne({ where });
        if (exists) {
          console.log(`중복: ${title}`);
          continue;
        }

        await models.healthNews.create({
          source: api.source,
          title,
          content, // 내용이 없으면 null (ex:동대문구보건소)
          created_at_api:  parseDate(item[api.dateKey]),
          link, // 링크가 있으면 저장
          extra: JSON.stringify(item),
        });

        savedCount++;
      }

      console.log(`${api.source}: ${list.length}건 중 ${savedCount}건 저장 완료`);
    } catch (err) {
      console.error(`${api.source} 실패:`, err.message);
    }
  }
}

fetchAndSave();