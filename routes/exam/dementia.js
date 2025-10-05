const fs = require("fs");
const path = require("path");
const models = require("../../models");
const stringSimilarity = require("string-similarity");
const speech = require("@google-cloud/speech");

const client = new speech.SpeechClient();

// ---------- 공통 상수 ----------
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

// ---------- 공통 함수 ----------

// 1. audio buffer → STT 결과 반환
async function getSTTResultFromBuffer(buffer, filename = "tempfile.bin") {
  const audioFile = path.join(__dirname, filename);
  await fs.promises.writeFile(audioFile, buffer);
  const audio = { content: fs.readFileSync(audioFile).toString("base64") };
  const config = {
    encoding: "MP3",
    sampleRateHertz: 16000,
    languageCode: "ko-KR",
  };
  const request = { audio, config };
  const [response] = await client.recognize(request);
  return response.results.map((r) => r.alternatives[0].transcript).join("\n");
}

// 2. N-gram 생성
function getNGrams(str, n = 2) {
  const grams = [];
  for (let i = 0; i <= str.length - n; i++) {
    grams.push(str.slice(i, i + n));
  }
  return grams;
}

// 3. N-gram 기반 Jaccard similarity
function nGramSimilarity(str1, str2, n = 2) {
  const grams1 = new Set(getNGrams(str1, n));
  const grams2 = new Set(getNGrams(str2, n));
  const intersection = new Set([...grams1].filter((x) => grams2.has(x)));
  const union = new Set([...grams1, ...grams2]);
  return intersection.size / union.size;
}

// 4. 단어 배열 vs 정답 배열 점수 계산
function calculateScore(answers, correct, options = {}) {
  const { nGramSize = 1, similarityThreshold = 0.5, useNGram = true } = options;
  let score = 0;

  correct.forEach((word) => {
    let matched = false;
    for (const answer of answers) {
      if (typeof answer !== "string") continue;
      let similarity = useNGram
        ? nGramSimilarity(word, answer, nGramSize)
        : stringSimilarity.compareTwoStrings(answer.replace(/\s+/g, ""), word);
      if (similarity >= similarityThreshold) {
        matched = true;
        break;
      }
    }
    if (matched) score += 1;
  });

  return score;
}

// 5. 공통 JSON 응답
function sendScoreResponse(res, message, score, details = null) {
  const response = { Message: message, ResultCode: "OK", Score: score };
  if (details) response.details = details;
  res.json(response);
}

// ---------- MMSE 항목 API ----------

// 1. 시간 지남력
async function gradeTimeOrientation(req, res) {
  try {
    const { answers } = req.body;
    if (!answers) throw new Error("answers 필요");

    const baseDate = new Date();
    const details = {};

    details.year = Number(answers.year) === baseDate.getFullYear();

    const month = baseDate.getMonth() + 1;
    const correctSeason = MONTH_TO_SEASON[month];
    details.season = false;

    if (answers.season) {
      const seasonAnswer = answers.season.trim();
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
      WEEKDAYS[baseDate.getDay() === 0 ? 6 : baseDate.getDay() - 1];
    details.weekday = answers.weekday === correctWeekday;

    const score = Object.values(details).filter((v) => v === true).length;
    sendScoreResponse(res, "시간 지남력 결과", score, details);
  } catch (err) {
    res.status(500).json({
      Message: "Internal server error",
      ResultCode: "ERR_INTERNAL_SERVER",
      msg: err.toString(),
    });
  }
}

// 2. 장소 지남력
async function gradePlaceOrientation(req, res) {
  try {
    const { answers } = req.body;
    if (!answers) throw new Error("answers 필요");
    const score = Object.values(answers).filter((v) => v === true).length;
    sendScoreResponse(res, "장소 지남력 결과", score);
  } catch (err) {
    res.status(500).json({
      Message: "Internal server error",
      ResultCode: "ERR_INTERNAL_SERVER",
      msg: err.toString(),
    });
  }
}

// 3. 기억 등록 / 반복 / 이름대기 (STT 기반)
async function gradeSTTHandler(
  req,
  res,
  correct,
  options = {},
  message = "기억 등록"
) {
  try {
    const sttResult = await getSTTResultFromBuffer(req.body);
    const answers = sttResult.split(/\s+/);
    const score = calculateScore(answers, correct, options);
    sendScoreResponse(res, message, score);
  } catch (err) {
    res.status(500).json({
      Message: "Internal server error",
      ResultCode: "ERR_INTERNAL_SERVER",
      msg: err.toString(),
    });
  }
}

function gradeRegistration(req, res) {
  gradeSTTHandler(
    req,
    res,
    ["나무", "자동차", "모자"],
    { nGramSize: 1, similarityThreshold: 0.5 },
    "기억 등록"
  );
}

function gradeNaming(req, res) {
  gradeSTTHandler(
    req,
    res,
    ["시계"],
    { useNGram: false, similarityThreshold: 0.5 },
    "이름 대기"
  );
}

function gradeRepetition(req, res) {
  gradeSTTHandler(
    req,
    res,
    ["간장공장공장장"],
    { useNGram: false, similarityThreshold: 0.5 },
    "따라 말하기"
  );
}

// 4. Serial Sevens
function gradeSerialSevens(req, res) {
  try {
    const { answers } = req.body;
    if (!Array.isArray(answers))
      throw new Error("입력은 숫자 배열이어야 합니다.");
    let score = 0,
      base = 100,
      result = [false, false, false, false, false];
    for (let i = 0; i < 5; i++) {
      if (base - 7 === answers[i]) {
        score++;
        result[i] = true;
      }
      base = answers[i];
      if (answers[i] < 7) break;
    }
    sendScoreResponse(res, "주의력(연산 능력)", score, { result });
  } catch (err) {
    res.status(500).json({
      Message: "Internal server error",
      ResultCode: "ERR_INTERNAL_SERVER",
      msg: err.toString(),
    });
  }
}

// 5. 단순 boolean 기반 항목
function gradeBooleanHandler(req, res, message = "Success") {
  try {
    const { answers } = req.body;
    if (!answers) throw new Error("answers 필요");
    const score = Object.values(answers).filter((v) => v === true).length;
    sendScoreResponse(res, message, score);
  } catch (err) {
    res.status(500).json({
      Message: "Internal server error",
      ResultCode: "ERR_INTERNAL_SERVER",
      msg: err.toString(),
    });
  }
}

function gradeThreeStepCommand(req, res) {
  gradeBooleanHandler(req, res, "3단계 명령");
}
function gradeConstructionalAbility(req, res) {
  gradeBooleanHandler(req, res, "구성 능력");
}
function gradeJugment(req, res) {
  gradeBooleanHandler(req, res, "판단 능력");
}

// 6. Delayed Recall
function gradeDelayedRecall(req, res) {
  gradeRegistration(req, res, "지연 회상");
}

/**
 * 총점 계산
 * @param {Object} scores - 항목별 점수 객체
 * scores:
 *   {
 *     timeOrientation: 5,
 *     placeOrientation: 5,
 *     registration: 3,
 *     serialSevens: 5,
 *     delayedRecall: 3,
 *     naming: 1,
 *     repetition: 1,
 *     threeStepCommand: 3,
 *     constructionalAbility: 1,
 *     judgment: 3
 *   }
 * @returns {Number} 총점
 */

function calculateTotalScore(scores) {
  return Object.values(scores).reduce(
    (total, score) => total + (score || 0),
    0
  );
}

async function saveScore(req, res) {
  const { scores } = req.body;
  const totalscore = await models.dementia.create({
    user_id: 2,
    total_score: calculateTotalScore(scores),
  });
  res.json({
    Message: "총점 저장 완료",
    ResultCode: "OK",
    TotalScore: totalscore,
  });
}
// ---------- 모듈 내보내기 ----------
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
  calculateTotalScore,
  saveScore,
};
