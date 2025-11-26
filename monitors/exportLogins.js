const { Sequelize, Op } = require("sequelize");
const { login_log } = require("../models");
const fs = require("fs");
const path = require("path");

(async () => {
  try {
    const now = new Date();
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000); // 5분 전

    const rows = await login_log.findAll({
      attributes: [
        "user_id",
        [Sequelize.fn("COUNT", Sequelize.col("id")), "logins_last_5m"],
        [
          Sequelize.fn(
            "COUNT",
            Sequelize.fn("DISTINCT", Sequelize.col("ip_address"))
          ),
          "distinct_ips",
        ],
        [
          Sequelize.fn(
            "SUM",
            Sequelize.literal("CASE WHEN login_result = true THEN 1 ELSE 0 END")
          ),
          "success_logins",
        ],
        [
          Sequelize.fn(
            "SUM",
            Sequelize.literal(
              "CASE WHEN login_result = false THEN 1 ELSE 0 END"
            )
          ),
          "failed_logins",
        ],
      ],
      where: {
        login_at: { [Op.gte]: fiveMinutesAgo },
      },
      group: ["user_id"],
      raw: true,
    });

    // 로그 경로
    const logPath = path.join(__dirname, "logs", "logins.json");

    // 기존 데이터 덮어쓰기 (최신만 필요하면 rows만 사용)
    fs.writeFileSync(logPath, JSON.stringify(rows, null, 2));

    console.log(`✅ 로그인 피처 ${rows.length}건 추출 완료`);
    process.exit(0);
  } catch (err) {
    console.error("❌ exportLogins error:", err);
    process.exit(1);
  }
})();
