const models = require("../../models");
const sha256 = require("sha256");
const { literal, Op } = require("sequelize");


// 1. 기관 측에서 광고 신청
// POST /facilities/{facilityId}/dashboard/advertisements
async function createAd(req, res) {
  try {
    const staff = req.session.user; // 이미 requireRole에서 체크됨
    const facilityId = parseInt(req.params.facilityId, 10);
    const { description, start_date, end_date } = req.body;

    if (isNaN(facilityId)) {
      return res.status(400).json({
        Message: "유효하지 않은 파라미터",
        ResultCode: "ERR_INVALID_PARAMETER",
      });
    }

    if (!description || !start_date || !end_date) {
      return res.status(400).json({ 
        Message: "필수 항목 누락" ,
        ResultCode: 'ERR_MISSING_PARAMETERS',
      });
    }

    if (isNaN(new Date(start_date)) || isNaN(new Date(end_date))) {
        return res.status(400).json({
            Message: "유효하지 않은 날짜 형식입니다.",
            ResultCode: "ERR_INVALID_DATE",
        });
    }
    
    if (new Date(start_date) > new Date(end_date)) {
      return res.status(400).json({
        Message: "광고 시작일은 종료일보다 이전이어야 합니다.",
        ResultCode: "ERR_INVALID_DATE_RANGE",
      });
    }

    // 해당 기관의 직원인지 체크
    if (staff.facility_id !== facilityId) {
      return res.status(403).json({ 
        Message: "해당 기관의 직원이 아닙니다.", 
        ResultCode: "ERR_FORBIDDEN" 
      });
    }

    const newAd = await models.advertisement.create({
      facility_id: facilityId,
      description,
      start_date,
      end_date,
      approval_status: 'pending', // 기본값 대기
    });

    return res.status(201).json({
        Message: "광고 신청이 완료되었습니다.",
        ResultCode: "SUCCESS",
        data: {
            id: newAd.id,
            facility_id: newAd.facility_id,
            approval_status: newAd.approval_status,
            start_date: newAd.start_date,
            end_date: newAd.end_date,
            description: newAd.description,
        },
    });

  } catch (err) {
    //bad request
    console.log("기관 측에서 광고 신청 오류:",err);
    res.status(500).send({
      Message: "광고 신청 처리 중 오류가 발생했습니다.",
      ResultCode: "ERR_SERVER",
      msg: err.toString(),
    });
  }
}

// 2. 광고 목록 조회
// 3. 광고 상세 조회

// 4. 기관 측에서 광고 수정
// PATCH /facilities/{facilityId}/dashboard/advertisements/{adId}
async function updateAd(req, res) {
  try {
    const staff = req.session.user; // 이미 requireRole에서 체크됨
    const facilityId = parseInt(req.params.facilityId, 10);
    const adId = parseInt(req.params.adId, 10);
    const { description, start_date, end_date } = req.body;

    if (isNaN(facilityId) || isNaN(adId)) {
      return res.status(400).json({
        Message: "유효하지 않은 파라미터",
        ResultCode: "ERR_INVALID_PARAMETER",
      });
    }
    // 일부만 보내도 가능
    if (!description && !start_date && !end_date) {
      return res.status(400).json({
        Message: "수정할 필드가 없습니다.",
        ResultCode: "ERR_MISSING_PARAMETERS",
      });
    }
    if (staff.facility_id !== facilityId) {
      return res.status(403).json({ 
        Message: "해당 기관의 직원이 아닙니다.", 
        ResultCode: "ERR_FORBIDDEN" 
      });
    }

    // 광고 존재 여부 확인
    const ad = await models.advertisement.findOne({
      where: { id: adId, facility_id: facilityId }
    });

    if (!ad) {
      return res.status(404).json({
        Message: "광고를 찾을 수 없습니다.",
        ResultCode: "ERR_NOT_FOUND",
      });
    }

    // 기존 값과 합쳐서 날짜 순서 체크
    const newStart = start_date ? new Date(start_date) : ad.start_date;
    const newEnd = end_date ? new Date(end_date) : ad.end_date;

    if (isNaN(newStart) || isNaN(newEnd)) {
      return res.status(400).json({
        Message: "유효하지 않은 날짜 형식입니다.",
        ResultCode: "ERR_INVALID_DATE",
      });
    }

    if (newStart > newEnd) {
      return res.status(400).json({
        Message: "광고 시작일은 종료일보다 이전이어야 합니다.",
        ResultCode: "ERR_INVALID_DATE_RANGE",
      });
    }

    // 수정
    await ad.update({
      description: description ?? ad.description,
      start_date: start_date ?? ad.start_date,
      end_date: end_date ?? ad.end_date
    });

    return res.status(200).json({
      Message: "광고 수정이 완료되었습니다.",
      ResultCode: "SUCCESS",
      data: ad,
    });

  } catch (err) {
    console.log("기관 측에서 광고 수정 오류:", err);
    res.status(500).send({
      Message: "광고 수정 중 오류가 발생했습니다.",
      ResultCode: "ERR_SERVER",
      msg: err.toString(),
    });
  }
}

// 5. 광고 신청 취소

module.exports = {
    createAd,
    updateAd,


}