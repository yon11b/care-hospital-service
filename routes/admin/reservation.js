const models = require("../../models");
const sha256 = require("sha256");
const { Op } = require("sequelize");
const app = require("../../app");
const { sequelize } = require("../../models");

// ===============================
// 기관의 예약 기능
// ===============================
// 1. 기관의 예약 목록 조회
// GET /reservations
async function getFacilityReservations(req, res) {
  try {
    const staff = req.session.user; // 세션 기반 로그인

    // 직원 소속 기관 확인
    // if (staff.facility_id !== facilityId) {
    //   return res.status(403).json({
    //     Message: "해당 기관의 예약 목록을 조회할 권한이 없습니다.",
    //     ResultCode: "ERR_FORBIDDEN",
    //   });
    // }
    const { status, startDate, endDate } = req.query;
    let where = {};
    // status 필터링
    if (status) {
      const upperStatus = status.toUpperCase();
      const validStatuses = ["PENDING", "CONFIRMED", "REJECTED", "CANCELED"];
      if (!validStatuses.includes(upperStatus)) {
        return res.status(400).json({
          Message: "유효하지 않은 상태값입니다.",
          ResultCode: "ERR_INVALID_STATUS",
        });
      }
      where.status = upperStatus;
    }

    // 예약자(User) 정보 include
    const include = [
      {
        model: models.user,
        attributes: ["id", "name", "phone", "email"],
        required: false,
      },
    ];
    // 날짜 필터링
    if (startDate || endDate) {
      where.reserved_date = {};
      if (startDate) where.reserved_date[Op.gte] = startDate; // startDate 이후
      if (endDate) where.reserved_date[Op.lte] = endDate; // endDate 이전
    }

    // 예약 조회 (전체 데이터, limit/offset 제거)
    const rows = await models.reservation.findAll({
      where,
      include,
      order: [["created_at", "DESC"]],
    });

    // ETag 생성 (간단히 데이터 JSON hash)
    const hash = require("crypto")
      .createHash("md5")
      .update(JSON.stringify(rows))
      .digest("hex");

    if (req.headers["if-none-match"] === hash) {
      // 클라이언트 데이터 최신이면 304 반환
      return res.status(304).end();
    }

    res.setHeader("ETag", hash);
    res.setHeader("Cache-Control", "private, max-age=60"); // 60초 캐시 허용
    return res.status(200).json({
      Message: "기관 예약 목록 조회 성공",
      ResultCode: "SUCCESS",
      data: rows,
    });
  } catch (err) {
    console.error("getFacilityReservations error:", err);
    return res.status(500).json({
      Message: "서버 에러",
      ResultCode: "ERR_SERVER",
      Error: err.message || err.toString(),
    });
  }
}

// 2. 기관의 특정 예약 상세 조회
// GET /reservations/:reservationId
async function getFacilityReservationDetail(req, res) {
  try {
    const staff = req.session.user; // 이미 requireRole에서 체크됨
    const facilityId = parseInt(req.params.facilityId, 10);
    const reservationId = parseInt(req.params.reservationId, 10);

    // 파라미터 체크
    if (isNaN(facilityId) || isNaN(reservationId)) {
      return res.status(400).json({
        Message: "유효하지 않은 파라미터",
        ResultCode: "ERR_INVALID_PARAMETER",
      });
    }

    // 1. 해당 기관의 직원인지 체크
    if (staff.facility_id !== facilityId) {
      return res.status(403).json({
        Message: "해당 기관의 직원이 아닙니다.",
        ResultCode: "ERR_FORBIDDEN",
      });
    }

    // 2. 예약 조회 (직원의 기관에 속한 예약만)
    const reservation = await models.reservation.findOne({
      where: { id: reservationId, facility_id: facilityId },
      include: [
        { model: models.user, attributes: ["id", "name", "phone"] },
        { model: models.facility, attributes: ["id", "name"] },
      ],
    });

    if (!reservation)
      return res
        .status(404)
        .json({ Message: "예약 없음", ResultCode: "ERR_NOT_FOUND" });

    // 3. 응답 포맷
    const responseData = {
      reservation: {
        id: reservation.id,
        reserved_date: reservation.reserved_date,
        reserved_time: reservation.reserved_time,
        status: reservation.status,
      },
      patient: {
        name: reservation.patient_name,
        birth: reservation.patient_birth,
        gender: reservation.patient_gender,
        phone: reservation.patient_phone,
        disease_type: reservation.disease_type,
        notes: reservation.notes,
      },
      reservation_user: {
        id: reservation.user.id,
        name: reservation.user.name,
        phone: reservation.user.phone,
      },
      facility: {
        id: reservation.facility.id,
        name: reservation.facility.name,
      },
    };

    return res.status(200).json({
      Message: "조회 성공",
      ResultCode: "SUCCESS",
      data: responseData,
    });
  } catch (err) {
    console.error("getFacilityReservationDetail error:", err);
    return res.status(500).json({
      Message: "서버 에러",
      ResultCode: "ERR_SERVER",
      Error: err.message || err.toString(),
    });
  }
}
module.exports = {
  getFacilityReservationDetail,
  getFacilityReservations,
};
