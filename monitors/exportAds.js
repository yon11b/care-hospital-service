const { sequelize } = require("../models");
const fs = require("fs");
const path = require("path");

(async () => {
  try {
    const [rows] = await sequelize.query(`
      SELECT
        user_id,
        COUNT(*) AS ads_last_30m,
        EXTRACT(HOUR FROM NOW()) AS hour_now
      FROM advertisements
      WHERE created_at >= NOW() - INTERVAL '30 minutes'
      GROUP BY user_id
    `);

    const logPath = path.join(__dirname, "logs", "ads.json");

    let existingData = [];
    if (fs.existsSync(logPath)) {
      try {
        const data = fs.readFileSync(logPath, "utf-8");
        existingData = JSON.parse(data);
        if (!Array.isArray(existingData)) existingData = [existingData];
      } catch (e) {
        console.warn("⚠️ 기존 ads.json 읽기 오류, 새로 생성합니다:", e.message);
      }
    }

    const updatedData = [...existingData, ...rows];
    fs.writeFileSync(logPath, JSON.stringify(updatedData, null, 2));

    console.log(
      `✅ 광고 피처 ${rows.length}건 추출 완료 (총 ${updatedData.length}건 누적됨)`
    );
    process.exit(0);
  } catch (err) {
    console.error("❌ exportAds error:", err);
    process.exit(1);
  }
})();
