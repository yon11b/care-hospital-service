const stringSimilarity = require("string-similarity");
const app = require("../../app");
const axios = require("axios");
const fs = require("fs");
const path = require("path");

const speech = require("@google-cloud/speech");

const client = new speech.SpeechClient();
async function quickstart(audioFile) {
  // The path to the remote LINEAR16 file stored in Google Cloud Storage
  //const gcsUri = "gs://cloud-samples-data/speech/brooklyn_bridge.raw";

  const audio = {
    content: fs.readFileSync(audioFile).toString("base64"),
  };
  // The audio file's encoding, sample rate in hertz, and BCP-47 language code

  const config = {
    encoding: "MP3",
    sampleRateHertz: 16000,
    languageCode: "ko-KR",
  };
  const request = {
    audio: audio,
    config: config,
  };

  // Detects speech in the audio file
  const [response] = await client.recognize(request);
  const transcription = response.results
    .map((result) => result.alternatives[0].transcript)
    .join("\n");
  console.log(`Transcription: ${transcription}`);
  return transcription;
}

const MONTH_TO_SEASON = {
  1: "겨울",
  2: "겨울",
  12: "겨울",
  3: "봄",
  4: "봄",
  5: "봄",
  6: "여름",
  7: "여름",
  8: "여름",
  9: "가을",
  10: "가을",
  11: "가을",
};

const WEEKDAYS = [
  "월요일",
  "화요일",
  "수요일",
  "목요일",
  "금요일",
  "토요일",
  "일요일",
];

/**
 * MMSE 시간 지남력 채점
 * @param {Object} answers - 환자 답변
 *  {
 *    year: 2025,
 *    month: 10
 *    season: "봄",
 *    day: 4,
 *    weekday: "금요일",
 *  }
 * @param {Date} baseDate - 기준 날짜 (시험일)
 * @returns {Object} {score, details: {year:true/false, season:true/false,...}}
 */
async function gradeTimeOrientation(req, res) {
  const { answers } = req.body;
  const baseDate = new Date();
  const details = {};

  // 1️⃣ 연도
  const yearAnswer = Number(answers.year);
  details.year = yearAnswer === baseDate.getFullYear();

  // 2️⃣ 계절
  const month = baseDate.getMonth() + 1; // JS는 0~11월
  const correctSeason = MONTH_TO_SEASON[month];
  details.season = false;

  if (answers.season) {
    const seasonAnswer = answers.season.trim();
    // 허용: 간절기 ±1 계절 허용
    const monthOffset = [month - 1, month, month + 1].map((m) =>
      m <= 0 ? m + 12 : m > 12 ? m - 12 : m
    );
    for (const m of monthOffset) {
      if (MONTH_TO_SEASON[m] === seasonAnswer) {
        details.season = true;
        break;
      }
    }
  }
  details.month = Number(answers.month) === month;
  details.day = Number(answers.day) === baseDate.getDate();
  const correctWeekday =
    WEEKDAYS[baseDate.getDay() === 0 ? 6 : baseDate.getDay() - 1]; // JS: 0=일요일
  details.weekday = answers.weekday === correctWeekday;

  const score = Object.values(details).filter((v) => v === true).length;
  return res.json({
    score,
    details,
  });
}

/**
 * 장소 지남력 측정 결과 저장
 * @body {
 *   answers: {
 *     province: boolean,  // 도/특별시/광역시
 *     city: boolean,      // 시/군/구
 *     town: boolean,      // 읍/면/동
 *     floor: boolean,     // 층수
 *     placeName: boolean  // 건물 이름
 *   }
 * }
 */
// 일단은 위에 꺼대로 안 하고 보호자로부터 true, false만 받는 걸로
async function gradePlaceOrientation(req, res) {
  const { answers } = req.body;
  if (!answers) {
    return res.status(400).json({
      message: "answers는 필수입니다.",
      resultCode: "ERR_MISSING_PARAM",
    });
  }
  const score = Object.values(answers).filter((v) => v === true).length;

  res.json({
    Message: "MMSE 장소 지남력 결과가 저장되었습니다.",
    ResultCode: "OK",
    Score: score,
  });
}
function getNGrams(str, n = 2) {
  const grams = [];
  for (let i = 0; i <= str.length - n; i++) {
    grams.push(str.slice(i, i + n));
  }
  return grams;
}

// Jaccard 유사도 계산
function nGramSimilarity(str1, str2, n = 2) {
  const grams1 = new Set(getNGrams(str1, n));
  const grams2 = new Set(getNGrams(str2, n));
  const intersection = new Set([...grams1].filter((x) => grams2.has(x)));
  const union = new Set([...grams1, ...grams2]);
  return intersection.size / union.size; // 0~1
}

async function gradeRegistration(req, res) {
  const correct = ["나무", "자동차", "모자"];

  const NGRAM_SIZE = 1;
  const SIMILARITY_THRESHOLD = 0.5; // Jaccard 기준
  try {
    console.log(req.body);
    const buffer = req.body;
    const audioFile = path.join(__dirname, "tempfile.bin");
    await fs.promises.writeFile(audioFile, buffer);
    console.log(audioFile);
    if (!audioFile) {
      return res.status(400).json({ message: "audioFile이 필요합니다." });
    }
    const sttResult = await quickstart(audioFile);
    // const sttResult = await transcribeService(audioFile);
    const answers = sttResult.split(/\s+/); // 공백 기준 배열로 변환
    console.log(`sttResult: ${sttResult}`);
    console.log(`answers: ${answers}`);

    let score = 0;
    correct.forEach((word) => {
      let matched = false;
      for (const answer of answers) {
        const similarity = nGramSimilarity(word, answer, NGRAM_SIZE);
        console.log(similarity);
        if (similarity >= SIMILARITY_THRESHOLD) {
          matched = true;
          break;
        }
      }
      if (matched) score += 1;
    });
    res.json({
      Message: "기억 등록",
      ResultCode: "OK",
      Score: score,
    });
  } catch (err) {
    return res.status(500).json({
      Message: "Internal server error",
      ResultCode: "ERR_INTERNAL_SERVER",
      msg: err.toString(),
    });
  }
}

function gradeSerialSevens(req, res) {
  const { answers } = req.body;
  if (!Array.isArray(answers))
    throw new Error("입력은 숫자 배열이어야 합니다.");

  let score = 0;
  let base = 100;
  let result = [false, false, false, false, false];
  for (let i = 0; i < answers.length; i++) {
    if (base - 7 == answers[i]) {
      score++;
      result[i] = true;
    }
    base = answers[i];
    if (answers[i] < 7) break;
  }

  return res.json({
    Message: "Success",
    ResultCode: "OK",
    result,
    Score: result.filter((v) => v === true).length,
  });
}

function gradeDelayedRecall(req, res) {
  gradeRegistration(req, res);
}

async function gradeNaming(req, res) {
  const correct = ["시계"];
  try {
    console.log(req.body);
    const buffer = req.body;
    const audioFile = path.join(__dirname, "tempfile.bin");
    await fs.promises.writeFile(audioFile, buffer);
    console.log(audioFile);
    if (!audioFile) {
      return res.status(400).json({ message: "audioFile이 필요합니다." });
    }
    const sttResult = await quickstart(audioFile);
    // const sttResult = await transcribeService(audioFile);
    const answers = sttResult.split(/\s+/); // 공백 기준 배열로 변환
    console.log(`sttResult: ${sttResult}`);
    console.log(`answers: ${answers}`);

    let score = 0;
    correct.forEach((word) => {
      if (answers.includes(word)) {
        score += 1;
      }
    });
    res.json({
      Message: "이름 대기",
      ResultCode: "OK",
      Score: score,
    });
  } catch (err) {
    return res.status(500).json({
      Message: "Internal server error",
      ResultCode: "ERR_INTERNAL_SERVER",
      msg: err.toString(),
    });
  }
}

async function gradeRepetition(req, res) {
  const SIMILARITY_THRESHOLD = 0.5; // Jaccard 기준
  const correct = "간장공장공장장";

  try {
    console.log(req.body);
    const buffer = req.body;
    const audioFile = path.join(__dirname, "tempfile.bin");
    await fs.promises.writeFile(audioFile, buffer);
    console.log(audioFile);
    if (!audioFile) {
      return res.status(400).json({ message: "audioFile이 필요합니다." });
    }
    let answers = await quickstart(audioFile);
    // answers = answers.trim();
    // console.log(answers);

    let score = 0;

    const similarity = stringSimilarity.compareTwoStrings(
      answers.replace(/\s+/g, ""),
      correct
    );
    if (similarity >= SIMILARITY_THRESHOLD) score = 1;
    res.json({
      Message: "기억 등록",
      ResultCode: "OK",
      Score: score,
    });
  } catch (err) {
    return res.status(500).json({
      Message: "Internal server error",
      ResultCode: "ERR_INTERNAL_SERVER",
      msg: err.toString(),
    });
  }
}
function gradeThreeStepCommand(req, res) {
  const { answers } = req.body;
  if (!answers) {
    return res.status(400).json({
      message: "answers는 필수입니다.",
      resultCode: "ERR_MISSING_PARAM",
    });
  }
  return res.json({
    Message: "Success",
    ResultCode: "OK",
    Score: answers.filter((v) => v === true).length,
  });
}

function gradeConstructionalAbility(req, res) {
  const { answers } = req.body.answers;
  if (!answers) {
    return res.status(400).json({
      message: "answers는 필수입니다.",
      resultCode: "ERR_MISSING_PARAM",
    });
  }
  return res.json({
    Message: "Success",
    ResultCode: "OK",
    Score: answers.filter((v) => v === true).length,
  });
}

function gradeJugment(req, res) {
  const { answers } = req.body;
  if (!answers) {
    return res.status(400).json({
      message: "answers는 필수입니다.",
      resultCode: "ERR_MISSING_PARAM",
    });
  }
  return res.json({
    Message: "Success",
    ResultCode: "OK",
    Score: answers.filter((v) => v === true).length,
  });
}

module.exports = {
  gradeTimeOrientation,
  gradePlaceOrientation,
  gradeRegistration,
  gradeSerialSevens,
  gradeDelayedRecall,
  gradeNaming,
  gradeRepetition,
  gradeThreeStepCommand,
  gradeConstructionalAbility,
  gradeJugment,
};
