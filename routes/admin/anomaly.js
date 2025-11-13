const models = require("../../models");
const { Op } = require("sequelize");

// ========================================
// 1. 리뷰 이상치 목록 조회 (-0.05 이상)
// GET /admin/anomalies/reviews
// ========================================
async function getReviewAnomalies(req, res) {
  try {
    const threshold = -0.05;

    const anomalies = await models.anomaly_alerts.findAll({
      where: {
        review_anomaly_score: {
          [Op.gte]: threshold, // -0.05 이상
        },
      },
      attributes: ["user_id", "review_anomaly_score"],
      order: [["review_anomaly_score", "DESC"]],
    });

    res.json({
      ResultCode: "OK",
      Message: "리뷰 이상치 조회 성공",
      total: anomalies.length,
      data: anomalies,
    });
  } catch (err) {
    console.error("admin - getReviewAnomalies err:", err.message);
    res.status(500).json({
      ResultCode: "ERR_INTERNAL_SERVER",
      Message: "서버 오류 발생",
      msg: err.toString(),
    });
  }
}

// ========================================
// 2. anomaly_alerts 전체 목록 조회
// GET /admin/anomalies/all
// ========================================
async function getAnomalies(req, res) {
  try {
    const anomalies = await models.anomaly_alert.findAll({
      order: [["created_at", "DESC"]],
      where: {
        status: "bad",
      },
    });

    res.json({
      ResultCode: "OK",
      Message: "전체 이상치 조회 성공",
      Size: anomalies.length,
      Response: anomalies,
    });
  } catch (err) {
    console.error("admin - getAllAnomalies err:", err.message);
    res.status(500).json({
      ResultCode: "ERR_INTERNAL_SERVER",
      Message: "서버 오류 발생",
      msg: err.toString(),
    });
  }
}

module.exports = {
  getReviewAnomalies,
  getAnomalies,
};
