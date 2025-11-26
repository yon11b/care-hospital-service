const { sequelize } = require("../models");
const fs = require("fs");
const path = require("path");

(async () => {
  try {
    // ---------- 최근 5분 리뷰 통계 ----------
    const [rows] = await sequelize.query(`
      SELECT
        user_id,
        COUNT(*) AS reviews_last_5m,
        EXTRACT(HOUR FROM NOW()) AS hour_now
      FROM reviews
      WHERE created_at >= NOW() - INTERVAL '5 minutes'
      GROUP BY user_id
    `);

    // ---------- JSON 저장 경로 ----------
    const logPath = path.join(__dirname, "logs", "reviews.json");

    // ---------- 기존 데이터 불러오기 ----------
    let existingData = [];
    if (fs.existsSync(logPath)) {
      try {
        const data = fs.readFileSync(logPath, "utf-8");
        existingData = JSON.parse(data);
        if (!Array.isArray(existingData)) existingData = [existingData];
      } catch (e) {
        console.warn(
          "⚠️ 기존 reviews.json 읽기 오류, 새로 생성합니다:",
          e.message
        );
      }
    }

    // ---------- 데이터 누적 ----------
    const updatedData = [...existingData, ...rows];

    fs.writeFileSync(logPath, JSON.stringify(updatedData, null, 2));

    console.log(
      `✅ 리뷰 피처 ${rows.length}건 추출 완료 (총 ${updatedData.length}건 누적됨)`
    );
    process.exit(0);
  } catch (err) {
    console.error("❌ exportReviews error:", err);
    process.exit(1);
  }
})();
