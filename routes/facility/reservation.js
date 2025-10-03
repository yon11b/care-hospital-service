const models = require('../../models');
const sha256 = require('sha256');
const app = require('../../app');
const Sequelize = require('sequelize');
const AWS = require('aws-sdk');
const { Op } = require('sequelize');

// 1. 예약하기
// /facility/{facilityId}/reservation
async function createReservation(req, res){
  try{
    const userId = req.user.id; // 로그인된 유저 정보 (JWT에서 추출)
    const facilityId  = parseInt(req.params.facilityId, 10); // 기관 id
    const { reserved_date, reserved_time, patient_name, patient_birth, patient_gender, patient_phone, disease_type, notes } = req.body;

    // 로그인 확인
    if(!userId){
        return res.status(401).send({
        Message: 'Unauthorized - 로그인 필요',
        ResultCode: 'ERR_UNAUTHORIZED',
      });
    }

    // 파라미터 확인
    if (isNaN(facilityId)) {
        return res.status(400).json({
            Message: "유효하지 않은 facilityId",
            ResultCode: "ERR_INVALID_PARAMETER"
        });
    }

    // body 확인
    if (!reserved_date || !reserved_time || !patient_phone || !patient_name || !patient_birth || !patient_gender || !disease_type) {
        return res.status(400).json({
            Message: '필수 값 누락',
            ResultCode: 'ERR_MISSING_PARAMETERS',
        });
    }


    // 1. 해당 기관 존재 여부 확인
    const facility = await models.facility.findByPk(facilityId);
    if (!facility) {
      return res.status(404).json({ 
        Message: "기관을 찾을 수 없습니다.",
        ResultCode: 'ERR_NOT_FOUND',
      });
    }    

    // 2. 중복 예약 체크 (같은 기관 + 같은 시간)
    const exists = await models.reservation.findOne({
      where: {
        facility_id: facilityId,
        reserved_date,
        reserved_time
      }
    });
    if (exists) {
      return res.status(409).json({ 
        Message: "이미 해당 시간에 예약이 존재합니다.",        
        ResultCode: 'ERR_RESERVATION_CONFLICT',
      });
    }

    // 3. disease_type 카테고리 확인
    const validDiseaseType = [
        '치매', '재활', '파킨슨', '뇌혈관성질환', '중풍', '암', '기타'
    ];
    if (!validDiseaseType.includes(disease_type)) {
      return res.status(400).json({
        Message: 'Invalid Disease Type',
        ResultCode: 'ERR_INVALID_Disease_Type',
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
      notes
    });

    // DB에서 user_name 조회
    const user = await models.user.findByPk(userId);

    return res.status(201).json({
      Message: `${user.name}님의 예약이 완료되었습니다.`,
      ResultCode : "SUCCESS",
      data: {
        reservation: reservation.dataValues,
        user_name: user.name
      }
    });

  } catch(err) {
    console.error('createReservation error:', err);
    return res.status(500).json({ 
      Message: '서버 에러', 
      ResultCode: 'ERR_SERVER',
      msg: err.message || err.toString(), 
    });
  }
}

// 
// 예약 취소


module.exports = { 
    createReservation,

};