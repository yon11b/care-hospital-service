const models = require("../../models");

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

// ---------- 메인 함수 ----------
/**
 * 모든 항목을 한 번에 채점하는 통합 함수
 * @param {Object} req.body.answers 전체 응답
 * {
 *   time: { year, month, day, season, weekday },
 *   place: { hospital: true, city: true, ... },
 *   serial: [93, 86, 79, 72, 65],
 *   delayed: { guardian: true },
 *   command: { guardian: false },
 *   construction: { guardian: true },
 *   judgment: { guardian: true }
 * }
 */
async function dementia(req, res) {
  try {
    const { answers } = req.body;
    if (!answers) throw new Error("answers 필요");

    // MMSE 항목별 채점
    const timeResult = gradeTimeOrientation(answers.time || {});
    const placeResult = gradePlaceOrientation(answers.place || {});
    const registrationResult = gradeRegistration(answers.registration || {});
    const serialResult = gradeSerialSevens(answers.serial || []);
    const delayedResult = gradeDelayedRecall(answers.delayed || {});
    const namingResult = gradeNaming(answers.naming || {});
    const repetitionResult = gradeRepetition(answers.repetition || {});
    const commandResult = gradeThreeStepCommand(answers.command || {});
    const constructionResult = gradeConstructionalAbility(
      answers.construction || {}
    );
    const judgmentResult = gradeJudgment(answers.judgment || {});

    // 점수 집계
    const scores = {
      timeOrientation: timeResult.Score,
      placeOrientation: placeResult.Score,
      registration: registrationResult.Score,
      serialSevens: serialResult.Score,
      delayedRecall: delayedResult.Score,
      naming: namingResult.Score,
      repetition: repetitionResult.Score,
      threeStepCommand: commandResult.Score,
      constructionalAbility: constructionResult.Score,
      judgment: judgmentResult.Score,
    };
    const totalScore = calculateTotalScore(scores);

    // DB 저장
    const result = await models.dementia.create({
      user_id: req.user.id,
      total_score: totalScore,
      orientation_time: timeResult.Score,
      orientation_place: placeResult.Score,
      registration: registrationResult.Score,
      attention_calculation: serialResult.Score,
      delay: delayedResult.Score,
      naming: namingResult.Score,
      repeat: repetitionResult.Score,
      three: commandResult.Score,
      construct: constructionResult.Score,
      judge: judgmentResult.Score,
    });

    res.json({
      Message: "전체 검사 완료",
      ResultCode: "OK",
      TotalScore: totalScore,
      Details: {
        timeResult,
        placeResult,
        registrationResult,
        serialResult,
        delayedResult,
        namingResult,
        repetitionResult,
        commandResult,
        constructionResult,
        judgmentResult,
      },
      Saved: result,
    });
  } catch (err) {
    res.status(500).json({
      Message: "Internal server error",
      ResultCode: "ERR_INTERNAL_SERVER",
      msg: err.toString(),
    });
  }
}

// ---------- 항목별 채점 함수 ----------

// 1. 시간 지남력
function gradeTimeOrientation(answers) {
  const baseDate = new Date();
  const details = {};

  details.year = Number(answers.year) === baseDate.getFullYear();

  const month = baseDate.getMonth() + 1;
  const correctSeason = MONTH_TO_SEASON[month];
  details.season = answers.season === correctSeason;
  details.month = Number(answers.month) === month;
  details.day = Number(answers.day) === baseDate.getDate();

  const correctWeekday =
    WEEKDAYS[baseDate.getDay() === 0 ? 6 : baseDate.getDay() - 1];
  details.weekday = answers.weekday === correctWeekday;

  const Score = Object.values(details).filter((v) => v === true).length;
  return { Title: "시간 지남력", Score, details };
}

// 2. 장소 지남력
function gradePlaceOrientation(answers) {
  const Score = Object.values(answers.guardian).filter(
    (v) => v === true
  ).length;
  return { Title: "장소 지남력", Score };
}

// 3. Serial Sevens
function gradeSerialSevens(answers) {
  if (!Array.isArray(answers))
    throw new Error("입력은 숫자 배열이어야 합니다.");
  let score = 0,
    base = 100,
    result = [false, false, false, false, false];
  for (let i = 0; i < 5; i++) {
    console.log(answers[i]);
    if (base - 7 == answers[i]) {
      score++;
      result[i] = true;
    }
    base = answers[i];
    if (answers[i] < 7) break;
  }

  return { Title: "주의력(연산 능력)", Score: score, details: { result } };
}

// 4. Boolean 기반 항목 (보호자 여부만 체크)
function gradeBooleanHandler(answers, title = "항목") {
  let Score = 0;

  if (Array.isArray(answers.guardian)) {
    // 배열이면 true 개수만큼 점수 부여
    Score = answers.guardian.filter((v) => v === true).length;
  } else {
    // 단일 boolean이면 1점 또는 0점
    Score = answers.guardian === true ? 1 : 0;
  }
  if (title == "이름 대기") Score *= 2;
  return { Title: title, Score };
}
function gradeRegistration(answers) {
  return gradeBooleanHandler(answers, "기억 등록");
}

function gradeDelayedRecall(answers) {
  return gradeBooleanHandler(answers, "지연 회상");
}
function gradeNaming(answers) {
  return gradeBooleanHandler(answers, "이름 대기");
}

function gradeRepetition(answers) {
  return gradeBooleanHandler(answers, "따라 말하기");
}
function gradeThreeStepCommand(answers) {
  return gradeBooleanHandler(answers, "3단계 명령");
}
function gradeConstructionalAbility(answers) {
  return gradeBooleanHandler(answers, "구성 능력");
}
function gradeJudgment(answers) {
  return gradeBooleanHandler(answers, "판단 능력");
}

// 5. 총점 계산
function calculateTotalScore(scores) {
  return Object.values(scores).reduce(
    (total, score) => total + (score || 0),
    0
  );
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
  gradeJudgment,
  dementia,
};
