const models = require("../../models");
const sha256 = require("sha256");
const app = require("../../app");
const Sequelize = require("sequelize");
const AWS = require("aws-sdk");
const { Op } = require("sequelize");

// ===============================
// 사용자의 예약 기능
// ===============================
// 1. 예약하기
// /facilities/{facilityId}/reservation
async function createReservation(req, res) {
  try {
    const userId = req.user.id; // 로그인된 유저 정보 (JWT에서 추출)
    const facilityId = parseInt(req.params.facilityId, 10); // 기관 id
    const {
      reserved_date,
      reserved_time,
      patient_name,
      patient_birth,
      patient_gender,
      patient_phone,
      disease_type,
      notes,
    } = req.body;

    // 로그인 확인
    if (!userId) {
      return res.status(401).send({
        Message: "Unauthorized - 로그인 필요",
        ResultCode: "ERR_UNAUTHORIZED",
      });
    }

    // 파라미터 확인
    if (isNaN(facilityId)) {
      return res.status(400).json({
        Message: "유효하지 않은 facilityId",
        ResultCode: "ERR_INVALID_PARAMETER",
      });
    }

    // body 확인
    if (
      !reserved_date ||
      !reserved_time ||
      !patient_phone ||
      !patient_name ||
      !patient_birth ||
      !patient_gender ||
      !disease_type
    ) {
      return res.status(400).json({
        Message: "필수 값 누락",
        ResultCode: "ERR_MISSING_PARAMETERS",
      });
    }

    // 1. 해당 기관 존재 여부 확인
    const facility = await models.facility.findByPk(facilityId);
    if (!facility) {
      return res.status(404).json({
        Message: "기관을 찾을 수 없습니다.",
        ResultCode: "ERR_NOT_FOUND",
      });
    }

    // 2. 중복 예약 체크 (같은 기관 + 같은 시간)
    const exists = await models.reservation.findOne({
      where: {
        facility_id: facilityId,
        reserved_date,
        reserved_time,
      },
    });
    if (exists) {
      return res.status(409).json({
        Message: "이미 해당 시간에 예약이 존재합니다.",
        ResultCode: "ERR_RESERVATION_CONFLICT",
      });
    }

    // 3. disease_type 카테고리 확인
    const validDiseaseType = [
      "치매",
      "재활",
      "파킨슨",
      "뇌혈관성질환",
      "중풍",
      "암",
      "기타",
    ];
    if (!validDiseaseType.includes(disease_type)) {
      return res.status(400).json({
        Message: "Invalid Disease Type",
        ResultCode: "ERR_INVALID_Disease_Type",
      });
    }

    // 4. 예약 생성
    const reservation = await models.reservation.create({
      facility_id: facilityId,
      user_id: userId,
      patient_name,
      patient_birth,
      patient_gender,
      patient_phone,
      disease_type,
      reserved_date,
      reserved_time,
      notes,
    });

    // DB에서 user_name 조회
    const user = await models.user.findByPk(userId);

    return res.status(201).json({
      Message: `${facility.name}에 ${user.name}님의 예약이 완료되었습니다.`,
      ResultCode: "SUCCESS",
      data: {
        reservation: {
          id: reservation.id,
          facility_id: reservation.facility_id,
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
          // 예약자
          id: user.id,
          name: user.name,
          phone: user.phone, // DB에 phone 필드 있다고 가정
        },
        facility: {
          id: facility.id,
          name: facility.name,
        },
      },
    });
  } catch (err) {
    console.error("createReservation error:", err);
    return res.status(500).json({
      Message: "서버 에러",
      ResultCode: "ERR_SERVER",
      msg: err.message || err.toString(),
    });
  }
}

// 유저의 예약 전체 조회
// GET /facilities/reservations/list
async function getReservations(req, res) {
  try {
    const userId = req.user.id; // 로그인 유저
    const page = parseInt(req.query.page, 10) || 1; // 기본 1페이지
    const limit = parseInt(req.query.limit, 10) || 10; // 한 페이지당 개수
    const offset = (page - 1) * limit; // offset 계산

    if (!userId) {
      return res.status(401).send({
        Message: "Unauthorized - 로그인 필요",
        ResultCode: "ERR_UNAUTHORIZED",
      });
    }

    // 총 예약 수
    const totalCount = await models.reservation.count({
      where: { user_id: userId },
    });

    // 예약 목록 조회
    const reservations = await models.reservation.findAll({
      where: { user_id: userId },
      limit,
      offset,
      attributes: ["id", "reserved_date", "status"],
      include: [
        { model: models.user, attributes: ["id", "name"] },
        { model: models.facility, attributes: ["id", "name"] },
      ],
      order: [["id", "DESC"]],
    });

    const totalPages = Math.ceil(totalCount / limit);

    const responseData = reservations.map((r) => ({
      reservation_id: r.id,
      user_name: r.user.name,
      facility_name: r.facility.name,
      reserved_date: r.reserved_date,
      status: r.status,
    }));

    res.status(200).json({
      Message: "Success",
      ResultCode: "OK",
      page,
      totalPages,
      totalCount,
      hasMore: page < totalPages,
      data: responseData,
    });
  } catch (err) {
    console.error(err);
    res.status(500).send({
      Message: "서버 에러",
      ResultCode: "ERR_SERVER",
      Error: err.message || err.toString(),
    });
  }
}

// 유저의 특정 예약 상세 조회
// //facilities/reservations/{reservationId}
async function getReservationDetail(req, res) {
  try {
    const userId = req.user.id; // 로그인 유저
    const reservationId = parseInt(req.params.reservationId, 10);

    if (!userId) {
      return res.status(401).json({
        Message: "Unauthorized - 로그인 필요",
        ResultCode: "ERR_UNAUTHORIZED",
      });
    }

    if (isNaN(reservationId)) {
      return res.status(400).json({
        Message: "유효하지 않은 reservationId",
        ResultCode: "ERR_INVALID_PARAMETER",
      });
    }

    // 특정 예약 조회 (로그인한 유저의 예약만 조회)
    const reservation = await models.reservation.findOne({
      where: {
        id: reservationId,
        user_id: userId,
      },
      attributes: [
        "id",
        "reserved_date",
        "reserved_time",
        "status",
        "patient_name",
        "patient_birth",
        "patient_gender",
        "patient_phone",
        "disease_type",
        "notes",
      ],
      include: [
        { model: models.user, attributes: ["id", "name"] }, // 예약자 정보
        { model: models.facility, attributes: ["id", "name"] }, // 기관 정보
      ],
    });

    if (!reservation) {
      return res.status(404).json({
        Message: "예약을 찾을 수 없습니다.",
        ResultCode: "ERR_NOT_FOUND",
      });
    }

    // 응답 포맷: 예약, 환자, 예약자, 기관 정보 분리
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
        // 예약자
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
      Message: "Success",
      ResultCode: "OK",
      data: responseData,
    });
  } catch (err) {
    console.error("getReservationDetail error:", err);
    return res.status(500).json({
      Message: "서버 에러",
      ResultCode: "ERR_SERVER",
      Error: err.message || err.toString(),
    });
  }
}

// 유저의 예약 취소
// patch /facilities/reservations/{reservationId}
async function cancelReservation(req, res) {
  try {
    const userId = req.user.id; // 로그인 유저
    const reservationId = parseInt(req.params.reservationId, 10);

    if (!userId) {
      // 로그인
      return res.status(401).json({
        Message: "Unauthorized - 로그인 필요",
        ResultCode: "ERR_UNAUTHORIZED",
      });
    }

    if (isNaN(reservationId)) {
      return res.status(400).json({
        Message: "유효하지 않은 reservationId",
        ResultCode: "ERR_INVALID_PARAMETER",
      });
    }

    // 예약 조회 (로그인한 유저 소유)
    const reservation = await models.reservation.findOne({
      where: { id: reservationId, user_id: userId },
    });

    if (!reservation) {
      return res.status(404).json({
        Message: "예약을 찾을 수 없습니다.",
        ResultCode: "ERR_NOT_FOUND",
      });
    }

    // PENDING 상태가 아니면 취소 불가
    if (reservation.status !== "PENDING") {
      return res.status(400).json({
        Message: "예약 상태가 PENDING이 아니면 취소할 수 없습니다.",
        ResultCode: "ERR_CANNOT_CANCEL",
        currentStatus: reservation.status,
      });
    }

    // 상태 변경
    reservation.status = "CANCELED";
    await reservation.save();

    return res.status(200).json({
      Message: "예약이 취소되었습니다.",
      ResultCode: "OK",
      data: {
        reservation_id: reservation.id,
        status: reservation.status,
      },
    });
  } catch (err) {
    console.error("cancelReservation error:", err);
    return res.status(500).json({
      Message: "서버 에러",
      ResultCode: "ERR_SERVER",
      Error: err.message || err.toString(),
    });
  }
}

// ===============================
// 기관의 예약 기능
// ===============================
// 1. 기관의 예약 목록 조회
// GET /facilities/{facilityId}/dashboard/reservations
async function getFacilityReservations(req, res) {
  try {
    const staff = req.session.user; // 세션 기반 로그인
    const facilityId = parseInt(req.params.facilityId, 10);

    if (isNaN(facilityId)) {
      return res.status(400).json({
        Message: "Invalid facilityId parameter",
        ResultCode: "ERR_INVALID_PARAM",
      });
    }

    // 직원 소속 기관 확인
    // if (staff.facility_id !== facilityId) {
    //   return res.status(403).json({
    //     Message: "해당 기관의 예약 목록을 조회할 권한이 없습니다.",
    //     ResultCode: "ERR_FORBIDDEN",
    //   });
    // }
    const { status, startDate, endDate } = req.query;

    // 기본 필터: facility_id
    let where = { facility_id: facilityId };

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
// GET /facilities/:facilityId/dashboard/reservations/:reservationId
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

// 3. 기관의 예약 승인/거절
// PATCH /facilities/:facilityId/dashboard/reservations/:reservationId/:status
async function updateFacilityReservationStatus(req, res) {
  try {
    const staff = req.session.user; // requireRole에서 이미 로그인/권한 체크
    const facilityId = parseInt(req.params.facilityId, 10);
    const reservationId = parseInt(req.params.reservationId, 10);
    const status = req.params.status.toUpperCase();

    // 유효한 status만 허용
    const validStatuses = ["CONFIRMED", "REJECTED"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        Message: "유효하지 않은 상태값입니다.",
        ResultCode: "ERR_INVALID_STATUS",
      });
    }

    // 직원 소속 기관 확인
    if (staff.facility_id !== facilityId) {
      return res.status(403).json({
        Message: "해당 기관의 직원이 아닙니다.",
        ResultCode: "ERR_FORBIDDEN",
      });
    }

    // 예약 조회
    const reservation = await models.reservation.findOne({
      where: { id: reservationId, facility_id: facilityId },
    });

    if (!reservation) {
      return res.status(404).json({
        Message: "예약 없음",
        ResultCode: "ERR_NOT_FOUND",
      });
    }

    // 현재 상태가 PENDING이 아니면 변경 불가
    if (reservation.status !== "PENDING") {
      return res.status(400).json({
        Message: "해당 건은 이미 처리된 예약입니다.",
        ResultCode: "ERR_INVALID_STATE",
      });
    }
    // 상태 변경
    reservation.status = status;
    await reservation.save();

    return res.status(200).json({
      Message: `예약 ${status === "CONFIRMED" ? "승인" : "거절"} 완료`,
      ResultCode: "SUCCESS",
      reservationId: reservation.id,
      updatedStatus: reservation.status,
      updatedAt: reservation.updated_at.toISOString(),
    });
  } catch (err) {
    console.error("updateReservationStatus error:", err);
    return res.status(500).json({
      Message: "서버 에러",
      ResultCode: "ERR_SERVER",
      Error: err.message,
    });
  }
}

module.exports = {
  createReservation,
  getReservations,
  getReservationDetail,
  cancelReservation,

  getFacilityReservations,
  getFacilityReservationDetail,
  updateFacilityReservationStatus,
};
