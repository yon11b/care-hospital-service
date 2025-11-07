const models = require("../../models");
const { Op } = require("sequelize");
const sequelize = models.sequelize; 

// ========================================
// 1. 통계 
// ========================================
// 1-1. 환자 통계 조회
// GET /facilities/{facilityId}/dashboard/statistics/patients
async function getPatientStatistics(req, res) {
  try {
    const staff = req.session.user; // 이미 requireRole에서 체크됨
    const facilityId = parseInt(req.params.facilityId, 10);

    if (isNaN(facilityId)) {
      return res.status(400).json({
        Message: "유효하지 않은 파라미터",
        ResultCode: "ERR_INVALID_PARAMETER",
      });
    }

    if (staff.facility_id !== facilityId) {
      return res.status(403).json({
        Message: "해당 기관의 직원이 아닙니다.",
        ResultCode: "ERR_FORBIDDEN",
      });
    }

    // facility_status 조회
    const status = await models.facility_status.findOne({
      where: { facility_id: facilityId },
    });

    if (!status) {
      return res.status(404).json({
        Message: "해당 시설 상태 정보가 없습니다.",
        ResultCode: "ERR_NOT_FOUND",
      });
    }

     
    const totalPatients = status.total_patients_count || 0;
    const userCapacity = status.user_capacity || 0;
    const usedBeds = totalPatients; 
    const remainingBeds = Math.max(userCapacity - totalPatients, 0);

    // 병상 사용률 계산 (소수점 2자리)
    const occupancyRate = userCapacity > 0 ? ((usedBeds / userCapacity) * 100).toFixed(2) : 0;

    res.status(200).json({
      Message: "환자 통계 조회 성공",
      ResultCode: "SUCCESS",
      data: {
        totalPatients,  // 현재 환자 수
        manPatients: status.man_patients_count || 0,     // 남자 환자 수
        womanPatients: status.woman_patients_count || 0, // 여자 환자 수
        userCapacity,   // 총 병상 수
        usedBeds,       // 사용 중 병상 수
        remainingBeds,  // 잔여 병상 수
        occupancyRate: Number(occupancyRate), // 병상 사용률
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      Message: "환자 통계 조회 실패",
      ResultCode: "ERR_INTERNAL_SERVER",
      error: err.message || err.toString(),
    });
  }
}

// 1-1-1. 환자 통계 수정하기
// PATCH /facilities/:facilityId/dashboard/statistics/patients
async function updatePatientStatistics(req, res){
  try {
    const staff = req.session.user; // 이미 requireRole에서 체크되었다고 가정
    const facilityId = parseInt(req.params.facilityId, 10);

    if (isNaN(facilityId)) {
      return res.status(400).json({
        Message: "유효하지 않은 파라미터",
        ResultCode: "ERR_INVALID_PARAMETER",
      });
    }

    if (staff.facility_id !== facilityId) {
      return res.status(403).json({
        Message: "해당 기관의 직원이 아닙니다.",
        ResultCode: "ERR_FORBIDDEN",
      });
    }

    // body에서 업데이트할 값 가져오기
    const { totalPatients, manPatients, womanPatients, userCapacity } = req.body;

    // facility_status 조회
    const status = await models.facility_status.findOne({
      where: { facility_id: facilityId },
    });

    if (!status) {
      return res.status(404).json({
        Message: "해당 시설 상태 정보가 없습니다.",
        ResultCode: "ERR_NOT_FOUND",
      });
    }

    // 값 업데이트
    if (totalPatients !== undefined) status.total_patients_count = totalPatients;
    if (manPatients !== undefined) status.man_patients_count = manPatients;
    if (womanPatients !== undefined) status.woman_patients_count = womanPatients;
    if (userCapacity !== undefined) status.user_capacity = userCapacity;

    await status.save();

    return res.status(200).json({
      Message: "환자 통계 수정되었습니다.",
      ResultCode: "SUCCESS",
      data: {
        totalPatients: status.total_patients_count,
        manPatients: status.man_patients_count,
        womanPatients: status.woman_patients_count,
        userCapacity: status.user_capacity,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      Message: "환자 통계 수정 실패",
      ResultCode: "ERR_INTERNAL_SERVER",
      error: err.message || err.toString(),
    });
  }
}

// 1-2. 오늘 예약 수, 상태별 예약 수(PENDING, CONFIRMED, CANCELED, REJECTED)
// GET /facilities/{facilityId}/dashboard/statistics/reservations
async function getReservationStatistics(req, res) {
  try {
    const staff = req.session.user; // 이미 requireRole에서 체크됨
    const facilityId = parseInt(req.params.facilityId, 10);
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD 형식


    if (isNaN(facilityId)) {
      return res.status(400).json({
        Message: "유효하지 않은 파라미터",
        ResultCode: "ERR_INVALID_PARAMETER",
      });
    }

    if (staff.facility_id !== facilityId) {
      return res.status(403).json({ 
        Message: "해당 기관의 직원이 아닙니다.", 
        ResultCode: "ERR_FORBIDDEN" 
      });
    }

    // 1. 오늘 예약 수
    const todayCount = await models.reservation.count({
      where: {
        facility_id: facilityId,
        reserved_date: today,
      },
    });

    // 2. 상태별 예약 수 (전체 기간)
    const statusCounts = await models.reservation.findAll({
      attributes: [
        'status',
        [sequelize.fn('COUNT', sequelize.col('status')), 'count'],
      ],
      where: { facility_id: facilityId },
      group: ['status'],
    });

    const statusData = {};
    statusCounts.forEach((row) => {
      statusData[row.status] = parseInt(row.dataValues.count, 10);
    });

    res.status(200).json({
      Message: '예약 통계 조회 성공',
      ResultCode: 'SUCCESS',
      data: {
        todayReservationCount: todayCount,
        statusCounts: {
          PENDING: statusData.PENDING || 0,
          CONFIRMED: statusData.CONFIRMED || 0,
          CANCELED: statusData.CANCELED || 0,
          REJECTED: statusData.REJECTED || 0,
        },
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      Message: '예약 통계 조회 실패',
      ResultCode: 'ERR_INTERNAL_SERVER',
      error,
    });
  }
}

// 1-3. 상담 건수
// GET /facilities/{facilityId}/dashboard/chats
async function getChatStatistics(req, res) {
  try {
    const staff = req.session.user; // 이미 requireRole에서 체크됨
    const facilityId = parseInt(req.params.facilityId, 10);

    if (isNaN(facilityId)) {
      return res.status(400).json({
        Message: "유효하지 않은 파라미터",
        ResultCode: "ERR_INVALID_PARAMETER",
      });
    }

    if (staff.facility_id !== facilityId) {
      return res.status(403).json({
        Message: "해당 기관의 직원이 아닙니다.",
        ResultCode: "ERR_FORBIDDEN",
      });
    }

    // 1. 총 상담 건수
    const totalChats = await models.chat_room.count({
      where: { facility_id: facilityId },
    });

    // 2. 오늘 상담 건수
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const todayChats = await models.chat_room.count({
      where: {
        facility_id: facilityId,
        created_at: { [Op.gte]: today }, // 오늘 생성된 채팅
      },
    });

    res.status(200).json({
      Message: "상담 통계 조회 성공",
      ResultCode: "SUCCESS",
      data: {
        totalChats,
        todayChats,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      Message: "상담 통계 조회 실패",
      ResultCode: "ERR_INTERNAL_SERVER",
      error,
    });
  }
}

module.exports = { 
    getPatientStatistics,
    updatePatientStatistics,
    getReservationStatistics,
    getChatStatistics,

};