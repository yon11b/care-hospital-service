// testPrompt.js
const { gptPromptJson } = require("./prompt");

// 🔹 예시 입력 10개
const testInputs = [
  "세종대 근처 의사 수가 5명 이상이고 환자 수가 50명 이하인 요양시설 찾아줘",
  "서울 강남구 주야간보호센터 신규 시설만 검색",
  "부산 해운대 요양원, 환자 수 30~60명, 의사 2명 이상",
  "대전 근처 요양병원, 치과의사 1명 포함",
  "인천 송도 요양원, 신규 설립, 환자 최대 40명",
  "강원도 춘천 주야간보호센터, 모든 전문의 필요",
  "서울 근처 요양병원, 최소 의사 수 3명, 최대 환자 수 70명",
  "대구 달서구 요양원, 신규 시설, 의사 4명 이상",
  "광주 광산구 요양병원, 치과의사 1명, 환자 최소 20명",
  "전주 근처 주야간보호센터, 신규, 의사 수 제한 없음",
];

// 🔹 예상 JSON 10개
const expectedOutputs = [
  {
    facility_kind: null,
    location: {
      sido: null,
      sggu: null,
      dong: null,
      near_me: true,
      coords: {
        name: "세종대학교",
        address: "서울 광진구 군자동 98",
        longitude: 127.0742595815513,
        latitude: 37.550638892935346,
      },
    },
    conditions: {
      max_patients: 50,
      min_patients: null,
      newly_established: false,
    },
    staff_conditions: {
      total_doctor: { required: true, min: 5, max: null, exact: null },
      medc_doctor: { required: false, min: null, max: null, exact: null },
      dent_doctor: { required: false, min: null, max: null, exact: null },
      hb_doctor: { required: false, min: null, max: null, exact: null },
      specialist_required: false,
    },
  },
  {
    facility_kind: "주야간보호센터",
    location: {
      sido: "서울",
      sggu: "강남구",
      dong: null,
      near_me: false,
      coords: null,
    },
    conditions: {
      max_patients: null,
      min_patients: null,
      newly_established: true,
    },
    staff_conditions: {
      total_doctor: { required: false, min: null, max: null, exact: null },
      medc_doctor: { required: false, min: null, max: null, exact: null },
      dent_doctor: { required: false, min: null, max: null, exact: null },
      hb_doctor: { required: false, min: null, max: null, exact: null },
      specialist_required: false,
    },
  },
  {
    facility_kind: "요양원",
    location: {
      sido: "부산",
      sggu: "해운대구",
      dong: null,
      near_me: false,
      coords: null,
    },
    conditions: {
      max_patients: 60,
      min_patients: 30,
      newly_established: false,
    },
    staff_conditions: {
      total_doctor: { required: true, min: 2, max: null, exact: null },
      medc_doctor: { required: false, min: null, max: null, exact: null },
      dent_doctor: { required: false, min: null, max: null, exact: null },
      hb_doctor: { required: false, min: null, max: null, exact: null },
      specialist_required: false,
    },
  },
  {
    facility_kind: "요양병원",
    location: {
      sido: null,
      sggu: null,
      dong: null,
      near_me: true,
      coords: {
        name: "대전역",
        address: "대전 동구 중앙로 234",
        longitude: 127.38443,
        latitude: 36.350411,
      },
    },
    conditions: {
      max_patients: null,
      min_patients: null,
      newly_established: false,
    },
    staff_conditions: {
      total_doctor: { required: false, min: null, max: null, exact: null },
      medc_doctor: { required: false, min: null, max: null, exact: null },
      dent_doctor: { required: true, min: 1, max: null, exact: null },
      hb_doctor: { required: false, min: null, max: null, exact: null },
      specialist_required: false,
    },
  },
  {
    facility_kind: "요양원",
    location: {
      sido: "인천",
      sggu: "송도",
      dong: null,
      near_me: false,
      coords: null,
    },
    conditions: {
      max_patients: 40,
      min_patients: null,
      newly_established: true,
    },
    staff_conditions: {
      total_doctor: { required: false, min: null, max: null, exact: null },
      medc_doctor: { required: false, min: null, max: null, exact: null },
      dent_doctor: { required: false, min: null, max: null, exact: null },
      hb_doctor: { required: false, min: null, max: null, exact: null },
      specialist_required: false,
    },
  },
  {
    facility_kind: "주야간보호센터",
    location: {
      sido: "강원도",
      sggu: "춘천",
      dong: null,
      near_me: false,
      coords: null,
    },
    conditions: {
      max_patients: null,
      min_patients: null,
      newly_established: false,
    },
    staff_conditions: {
      total_doctor: { required: false, min: null, max: null, exact: null },
      medc_doctor: { required: false, min: null, max: null, exact: null },
      dent_doctor: { required: false, min: null, max: null, exact: null },
      hb_doctor: { required: false, min: null, max: null, exact: null },
      specialist_required: true,
    },
  },
  {
    facility_kind: "요양병원",
    location: {
      sido: null,
      sggu: null,
      dong: null,
      near_me: true,
      coords: {
        name: "서울역",
        address: "서울 중구 한강대로 405",
        longitude: 126.970701,
        latitude: 37.554722,
      },
    },
    conditions: {
      max_patients: 70,
      min_patients: null,
      newly_established: false,
    },
    staff_conditions: {
      total_doctor: { required: true, min: 3, max: null, exact: null },
      medc_doctor: { required: false, min: null, max: null, exact: null },
      dent_doctor: { required: false, min: null, max: null, exact: null },
      hb_doctor: { required: false, min: null, max: null, exact: null },
      specialist_required: false,
    },
  },
  {
    facility_kind: "요양원",
    location: {
      sido: "대구",
      sggu: "달서구",
      dong: null,
      near_me: false,
      coords: null,
    },
    conditions: {
      max_patients: null,
      min_patients: null,
      newly_established: true,
    },
    staff_conditions: {
      total_doctor: { required: true, min: 4, max: null, exact: null },
      medc_doctor: { required: false, min: null, max: null, exact: null },
      dent_doctor: { required: false, min: null, max: null, exact: null },
      hb_doctor: { required: false, min: null, max: null, exact: null },
      specialist_required: false,
    },
  },
  {
    facility_kind: "요양병원",
    location: {
      sido: "광주",
      sggu: "광산구",
      dong: null,
      near_me: false,
      coords: null,
    },
    conditions: {
      max_patients: null,
      min_patients: 20,
      newly_established: false,
    },
    staff_conditions: {
      total_doctor: { required: false, min: null, max: null, exact: null },
      medc_doctor: { required: false, min: null, max: null, exact: null },
      dent_doctor: { required: true, min: 1, max: null, exact: null },
      hb_doctor: { required: false, min: null, max: null, exact: null },
      specialist_required: false,
    },
  },
  {
    facility_kind: "주야간보호센터",
    location: {
      sido: null,
      sggu: null,
      dong: null,
      near_me: true,
      coords: {
        name: "전주역",
        address: "전북 전주시 덕진구 백제대로 789",
        longitude: 127.152,
        latitude: 35.829,
      },
    },
    conditions: {
      max_patients: null,
      min_patients: null,
      newly_established: true,
    },
    staff_conditions: {
      total_doctor: { required: false, min: null, max: null, exact: null },
      medc_doctor: { required: false, min: null, max: null, exact: null },
      dent_doctor: { required: false, min: null, max: null, exact: null },
      hb_doctor: { required: false, min: null, max: null, exact: null },
      specialist_required: false,
    },
  },
];

function jsonMatchRatio(actual, expected) {
  let total = 0;
  let matched = 0;

  function compare(a, b) {
    if (typeof a !== typeof b) {
      total++;
      return;
    }

    if (a === null || b === null) {
      total++;
      if (a === b) matched++;
      return;
    }

    if (typeof a !== "object") {
      total++;
      if (a === b) matched++;
      return;
    }

    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    keys.forEach((k) => compare(a[k], b[k]));
  }

  compare(actual, expected);
  return total === 0 ? 100 : (matched / total) * 100;
}

// 🔹 테스트 실행
(async () => {
  let totalRatio = 0;

  for (let i = 0; i < testInputs.length; i++) {
    console.log(`\n[테스트 ${i + 1}] ${testInputs[i]}`);
    const result = await gptPromptJson(testInputs[i]);

    const ratio = jsonMatchRatio(result, expectedOutputs[i]);
    console.log("출력 결과:", JSON.stringify(result, null, 2));
    console.log("예상 결과:", JSON.stringify(expectedOutputs[i], null, 2));
    console.log(`🔹 일치율: ${ratio.toFixed(1)}%`);

    totalRatio += ratio;
  }

  const avgRatio = totalRatio / testInputs.length;
  console.log(`\n전체 평균 정확도: ${avgRatio.toFixed(1)}%`);
})();
