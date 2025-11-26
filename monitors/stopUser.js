const models = require("../models");

async function suspendUser() {
  try {
    // 1. 아직 처리되지 않은 anomaly 조회
    const anomalies = await models.anomaly_alert.findAll({
      where: { is_processed: false },
    });

    if (!anomalies || anomalies.length === 0) {
      console.log("처리할 이상치 없음");
      return;
    }

    for (const anomaly of anomalies) {
      const userId = anomaly.user_id;

      // 2. staff 테이블에서 user_id와 일치하는 계정 조회
      const staff = await models.staff.findOne({ where: { id: userId } });
      if (!staff) {
        console.log(`staff id ${userId} 계정을 찾을 수 없음`);
        continue;
      }

      // 3. approval_status를 'blocked'로 업데이트
      await staff.update({ approval_status: "blocked" });

      // 4. anomaly_alerts에서 처리 완료 표시
      await anomaly.update({ is_processed: true });

      console.log(`user_id ${userId} 계정을 차단하고 anomaly 처리 완료`);
    }
  } catch (err) {
    console.error("계정 정지 처리 중 오류 발생:", err);
  }
}

// 실행
suspendUser();
