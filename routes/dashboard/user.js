const { Sequelize } = require("sequelize");
const { Op } = require("sequelize");
const models = require("../../models");

// 월간 이용자 수 조회 함수
async function getActiveUsers(req, res) {
  try {
    if (!req.session.user || req.session.user.role !== "admin") {
      return res.status(403).send({
        Message: "Forbidden - 접근 권한이 없습니다.",
        ResultCode: "ERR_FORBIDDEN",
      });
    }
    const result = await models.login_log.findAll({
      attributes: [
        // YYYY-MM 형태로 월 추출 (PostgreSQL 기준)
        [
          Sequelize.fn(
            "TO_CHAR",
            Sequelize.fn("DATE_TRUNC", "month", Sequelize.col("login_at")),
            "YYYY-MM"
          ),
          "month",
        ],
        [
          Sequelize.fn(
            "COUNT",
            Sequelize.fn("DISTINCT", Sequelize.col("user_id"))
          ),
          "active_users",
        ],
      ],
      group: [Sequelize.fn("DATE_TRUNC", "month", Sequelize.col("login_at"))],
      order: [
        [Sequelize.fn("DATE_TRUNC", "month", Sequelize.col("login_at")), "ASC"],
      ],
      raw: true,
    });
    return res.status(200).send({
      Message: "monthly active user number get successfully",
      ResultCode: "ERR_OK",
      Response: result,
    });
  } catch (err) {
    console.log(err);
    return res.status(500).send({
      Message: err.message || "Internal server error",
      ResultCode: "ERR_INTERNAL_SERVER",
      err,
    });
  }
}

// 최근 1개월 신규 회원 조회
async function getNewUsers(req, res) {
  try {
    // 관리자 권한 체크
    if (!req.session.user || req.session.user.role !== "admin") {
      return res.status(403).send({
        Message: "Forbidden - 접근 권한이 없습니다.",
        ResultCode: "ERR_FORBIDDEN",
      });
    }

    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 3);

    const newUsers = await models.staff.findAll({
      where: {
        created_at: {
          [Op.gte]: oneMonthAgo, // created_at >= 3개월 전
        },
      },
      attributes: [
        "id",
        "facility_id",
        "name",
        "email",
        "role",
        "approval_status",
        "created_at",
      ],
      order: [["created_at", "DESC"]],
      raw: true,
    });

    return res.status(200).json({
      Message: "Recent 3 month register users select successfully.",
      ResultCode: "ERR_OK",
      Size: newUsers.length,
      Response: newUsers,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      result: false,
      msg: err.message || "Internal server error",
    });
  }
}

module.exports = {
  getActiveUsers,
  getNewUsers,
};
