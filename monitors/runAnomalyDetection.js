const cron = require("node-cron");
const { execSync } = require("child_process");
const path = require("path");

cron.schedule("*/5 * * * *", async () => {
  console.log("[Monitor] 탐지 시작:", new Date());
  try {
    console.log(`[${new Date().toISOString()}] 이상탐지 시작`);

    // 1. 각 도메인별 JSON 파일로 로그 export
    execSync(`node "${path.join(__dirname, "exportReviews.js")}"`, {
      stdio: "inherit",
    });
    execSync(`node "${path.join(__dirname, "exportAds.js")}"`, {
      stdio: "inherit",
    });
    execSync(`node "${path.join(__dirname, "exportLogins.js")}"`, {
      stdio: "inherit",
    });
    // 2. Python으로 모델 스코어링 실행
    // 여러 JSON 경로를 인자로 전달
    const reviewsPath = path.join(__dirname, "logs", "reviews.json");
    const adsPath = path.join(__dirname, "logs", "ads.json");
    const loginsPath = path.join(__dirname, "logs", "logins.json");

    execSync(
      `python "${path.join(__dirname, "plot_anomaly.py")}" "${reviewsPath}" "${adsPath}" "${loginsPath}"`,
      { stdio: "inherit" }
    );

    console.log(`[${new Date().toISOString()}] 이상탐지 완료`);
  } catch (err) {
    console.error("Cron anomaly job error:", err);
  }
});
