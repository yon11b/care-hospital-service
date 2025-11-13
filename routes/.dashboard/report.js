const { Sequelize } = require("sequelize");
const models = require("../../models");

// 공통: type별 모델 매핑
const typeModelMap = {
  REVIEW: { model: models.review, alias: "review" },
  COMMENT: { model: models.comment, alias: "comment" },
  COMMUNITY: { model: models.community, alias: "community" },
};

// 1. 신고 목록 조회 (관리자용)
async function getReportedReviews(req, res) {
  try {
    if (!req.session.user || req.session.user.role !== "admin") {
      return res.status(403).json({
        Message: "관리자 권한이 필요합니다.",
        ResultCode: "ERR_FORBIDDEN",
      });
    }

    const { type = "REVIEW" } = req.query;
    if (!typeModelMap[type]) {
      return res.status(400).json({
        Message: `유효하지 않은 type입니다.`,
        ResultCode: "ERR_INVALID_TYPE",
      });
    }

    const { model: targetModel } = typeModelMap[type];

    const reports = await models.report.findAll({
      where: { type },
      include: [
        {
          model: targetModel,
          attributes: ["id", "content", "rating", "images"],
        },
        { model: models.user, attributes: ["id", "name", "email", "phone"] },
      ],
      order: [["created_at", "DESC"]],
      raw: false,
    });

    res.json({
      Message: `${type} 신고 목록 조회 성공`,
      ResultCode: "ERR_OK",
      Size: reports.length,
      Reports: reports,
    });
  } catch (err) {
    console.error("getReportedReviews error:", err);
    res.status(500).json({
      Message: "Internal server error",
      ResultCode: "ERR_INTERNAL_SERVER",
      msg: err.toString(),
    });
  }
}

// 2. 신고 처리 (삭제 / 상태 변경) — type은 report에서 가져옴
async function handleReportedReview(req, res) {
  try {
    if (!req.session.user || req.session.user.role !== "admin") {
      return res.status(403).json({
        Message: "관리자 권한이 필요합니다.",
        ResultCode: "ERR_FORBIDDEN",
      });
    }

    const { reportId } = req.params;
    const { action } = req.body; // "PENDING" | "APPROVED" | "REJECTED"

    // 신고 조회
    const reportTemp = await models.report.findOne({ where: { id: reportId } });

    if (!reportTemp) {
      return res.status(404).json({
        Message: "신고 내역을 찾을 수 없습니다.",
        ResultCode: "ERR_NOT_FOUND",
      });
    }

    const reportType = reportTemp.type;

    if (!typeModelMap[reportType]) {
      return res.status(400).json({
        Message: `지원하지 않는 type입니다.`,
        ResultCode: "ERR_INVALID_TYPE",
      });
    }

    const { model: targetModel, alias } = typeModelMap[reportType];

    // report + target 모델 조인
    const report = await models.report.findOne({
      where: { id: reportId },
      include: [{ model: targetModel, as: alias }],
    });

    const targetData = report[alias];
    if (!targetData) {
      return res.status(404).json({
        Message: `${reportType} 데이터를 찾을 수 없습니다.`,
        ResultCode: "ERR_TARGET_NOT_FOUND",
      });
    }

    // 상태 업데이트
    if (action === "PENDING") {
      await report.update({ status: "PENDING" });
      await targetData.update({ status: "REPORT_PENDING" });
      return res.json({
        Message: "신고가 대기처리 되었습니다.",
        ResultCode: "ERR_OK",
        Response: report,
      });
    } else if (action === "APPROVED") {
      await report.update({ status: "APPROVED" });
      await targetData.update({ status: "DELETED" });
      return res.json({
        Message: "신고가 승인되었습니다.",
        ResultCode: "ERR_OK",
        Response: report,
      });
    } else if (action === "REJECTED") {
      await report.update({ status: "REJECTED" });
      await targetData.update({ status: "ACTION" });
      return res.json({
        Message: "신고가 무시되었습니다.",
        ResultCode: "ERR_OK",
        Response: report,
      });
    } else {
      return res.status(400).json({
        Message: "유효하지 않은 action 값입니다.",
        ResultCode: "ERR_INVALID_ACTION",
      });
    }
  } catch (err) {
    console.error("handleReportedReview error:", err);
    res.status(500).json({
      Message: "Internal server error",
      ResultCode: "ERR_INTERNAL_SERVER",
      msg: err.toString(),
    });
  }
}

module.exports = {
  getReportedReviews,
  handleReportedReview,
};
