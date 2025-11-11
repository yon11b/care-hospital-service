const { Op, Sequelize } = require("sequelize");
const models = require("../models");

// ------------------------
// API용 함수 (Express)
// ------------------------
// async function detectReviewManipulation(req, res) {
//   try {
//     const data = await detectReviewManipulationCron();
//     res.json({ result: true, type: "review_manipulation", data });
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ result: false, msg: err.message });
//   }
// }

// async function detectFacilityEdit(req, res) {
//   try {
//     const data = await detectFacilityEditCron();
//     res.json({ result: true, type: "facility_edit", data });
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ result: false, msg: err.message });
//   }
// }

// 다른 API용 함수도 동일하게 생성...

// ------------------------
// Cron용 함수 (DB 조회 후 결과 반환)
// ------------------------
async function detectReviewManipulationCron() {
  const oneMinuteAgo = new Date();
  oneMinuteAgo.setMinutes(oneMinuteAgo.getMinutes() - 1);
  return await models.review.findAll({
    attributes: [
      "facility_id",
      "user_id",
      [Sequelize.fn("COUNT", Sequelize.col("id")), "count"],
    ],
    where: {
      created_at: { [Sequelize.Op.gte]: oneMinuteAgo }, // 최근 1분
    },
    group: ["facility_id", "user_id"],
    having: Sequelize.literal("COUNT(id) > 5"),
    order: [[Sequelize.literal("count"), "DESC"]],
    raw: true,
  });
}

async function detectFacilityEditCron() {
  const oneDayAgo = new Date();
  oneDayAgo.setDate(oneDayAgo.getDate() - 1);

  // facility_logs 테이블 기준
  return await models.facility_log.findAll({
    attributes: [
      "facility_id",
      [Sequelize.fn("COUNT", Sequelize.col("id")), "count"],
    ],
    where: {
      action: "UPDATE", // UPDATE만 체크
      created_at: { [Op.gte]: oneDayAgo }, // 지난 1일 내
    },
    group: ["facility_id"],
    having: Sequelize.literal("COUNT(id) >= 3"), // 하루 3회 이상 수정
    raw: true,
  });
}
async function detectAdFloodCron() {
  const oneHourAgo = new Date();
  oneHourAgo.setHours(oneHourAgo.getHours() - 1);

  return await models.audit_logs.findAll({
    attributes: [
      "entity_id",
      [Sequelize.fn("COUNT", Sequelize.col("id")), "count"],
    ],
    where: {
      entity_type: "ad",
      action: "CREATE",
      created_at: { [Op.gte]: oneHourAgo },
    },
    group: ["entity_id"],
    having: Sequelize.literal("COUNT(id) >= 5"),
    raw: true,
  });
}

async function detectReservationAbuseCron() {
  const tenMinutesAgo = new Date();
  tenMinutesAgo.setMinutes(tenMinutesAgo.getMinutes() - 10);

  return await models.reservation_logs.findAll({
    attributes: [
      "user_id",
      [Sequelize.fn("COUNT", Sequelize.col("id")), "count"],
    ],
    where: {
      action: { [Op.in]: ["RESERVE", "CANCEL"] },
      created_at: { [Op.gte]: tenMinutesAgo },
    },
    group: ["user_id"],
    having: Sequelize.literal("COUNT(id) >= 3"),
    raw: true,
  });
}

async function detectAbnormalLoginCron() {
  return await models.login_log.findAll({
    attributes: [
      "user_id",
      "ip_address",
      [Sequelize.fn("COUNT", Sequelize.col("id")), "fail_count"],
    ],
    where: {
      action: "LOGIN_FAIL",
    },
    group: ["user_id", "ip_address"],
    having: Sequelize.literal("COUNT(id) >= 5"),
    raw: true,
  });
}

async function detectAdminAbuseCron() {
  const oneHourAgo = new Date();
  oneHourAgo.setHours(oneHourAgo.getHours() - 1);

  return await models.audit_logs.findAll({
    attributes: [
      "user_id",
      [Sequelize.fn("COUNT", Sequelize.col("id")), "action_count"],
    ],
    where: {
      action: { [Op.in]: ["APPROVE", "DELETE"] },
      created_at: { [Op.gte]: oneHourAgo },
    },
    group: ["user_id"],
    having: Sequelize.literal("COUNT(id) >= 5"),
    raw: true,
  });
}

module.exports = {
  // API용
  // detectReviewManipulation,
  // detectFacilityEdit,
  // Cron용
  detectReviewManipulationCron,
  detectFacilityEditCron,
  detectAdFloodCron,
  detectReservationAbuseCron,
  detectAbnormalLoginCron,
  detectAdminAbuseCron,
};
