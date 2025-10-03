const models = require('../../models');
const sha256 = require('sha256');
const app = require('../../app');
const Sequelize = require('sequelize');
const AWS = require('aws-sdk');
const { Op } = require('sequelize');

// 1. 예약하기
// /facilities/{facilityId}/reservation
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
      Message: `${facility.name}에 ${user.name}님의 예약이 완료되었습니다.`,
      ResultCode : "SUCCESS",
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
          notes: reservation.notes
        },
        reservation_user: { // 예약자
          id: user.id,
          name: user.name,
          phone: user.phone // DB에 phone 필드 있다고 가정
        },
        facility: {
          id: facility.id,
          name: facility.name
        }
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

// 유저의 예약 전체 조회
// /facilities/reservation
async function getReservations(req, res) {
  try{
    const userId = req.user.id; // 로그인 유저
    const limit = parseInt(req.query.limit, 10) || 10;  // 한 번에 가져올 개수 : 기본 10개
    const lastId = req.query.lastId || null ; // 마지막으로 가져온 예약 id

    if(!userId){ // 로그인 확인
        return res.status(401).send({
            Message: 'Unauthorized - 로그인 필요',
            ResultCode: 'ERR_UNAUTHORIZED',
      });
    }
    
    // 조회 조건
    const where = { user_id: userId }; // 사용자
    if (lastId) {
      where.id = { [Sequelize.Op.lt]: lastId }; // 마지막 글보다 작은 id만 가져오기
    }

    // 예약자, 병원 이름, 예약일, 예약 상태 포함 조회
    const reservations = await models.reservation.findAll({
      where,
      limit: limit + 1, // hasMore 체크를 위해 한 개 더 가져오기
      attributes: ['id','reserved_date', 'status'], // reservation에서 필요한 컬럼
      include: [
        { model: models.user, attributes: ['id', 'name'] }, // 예약자 이름
        { model: models.facility, attributes: ['id', 'name'] } // 기관 이름
      ],
      order: [['id', 'DESC']] // id 기준 예약 순서
    });

    let hasMore = false;
    if (reservations.length > limit) {
      hasMore = true;
      reservations.pop(); // 넘친 1개 제거
    }

    const responseData = reservations.map(r => ({
      reservation_id: r.id,
      user_name: r.user.name,
      facility_name: r.facility.name,
      reserved_date: r.reserved_date,
      status: r.status,
    }));

    // 응답(Response) 보내기
    res.status(200).json({
      Message: 'Success',
      ResultCode: 'OK',
      hasMore, // 다음 페이지가 있는지 쉽게 판단 (hasMore).
      data: responseData,
    });


  } catch(err){
    //bad request
    console.log(err);
    res.status(500).send({
      Message: '서버 에러',
      ResultCode: 'ERR_SERVER',
      Error: err.message || err.toString(),
    });
  }
}

// 유저의 특정 예약 상세 조회
// //facilities/reservation/{reservationId}
async function getReservationDetail(req, res){
  try {
    const userId = req.user.id; // 로그인 유저
    const reservationId = parseInt(req.params.reservationId, 10);

    if (!userId) {
      return res.status(401).json({
        Message: 'Unauthorized - 로그인 필요',
        ResultCode: 'ERR_UNAUTHORIZED',
      });
    }

    if (isNaN(reservationId)) {
      return res.status(400).json({
        Message: '유효하지 않은 reservationId',
        ResultCode: 'ERR_INVALID_PARAMETER',
      });
    }

    // 특정 예약 조회 (로그인한 유저의 예약만 조회)
    const reservation = await models.reservation.findOne({
      where: {
        id: reservationId,
        user_id: userId,
      },
      attributes: ['id','reserved_date','reserved_time','status','patient_name','patient_birth','patient_gender','patient_phone','disease_type','notes'],
      include: [
        { model: models.user, attributes: ['id','name'] },       // 예약자 정보
        { model: models.facility, attributes: ['id','name'] }    // 기관 정보
      ]
    });

    if (!reservation) {
      return res.status(404).json({
        Message: '예약을 찾을 수 없습니다.',
        ResultCode: 'ERR_NOT_FOUND',
      });
    }

    // 응답 포맷: 예약, 환자, 예약자, 기관 정보 분리
    const responseData = {
      reservation: {
        id: reservation.id,
        reserved_date: reservation.reserved_date,
        reserved_time: reservation.reserved_time,
        status: reservation.status
      },
      patient: {
        name: reservation.patient_name,
        birth: reservation.patient_birth,
        gender: reservation.patient_gender,
        phone: reservation.patient_phone,
        disease_type: reservation.disease_type,
        notes: reservation.notes
      },
      reservation_user: {  // 예약자
        id: reservation.user.id,
        name: reservation.user.name,
        phone: reservation.user.phone
      },
      facility: {
        id: reservation.facility.id,
        name: reservation.facility.name
      }
    };


    return res.status(200).json({
      Message: 'Success',
      ResultCode: 'OK',
      data: responseData,
    });

  } catch (err) {
    console.error('getReservationDetail error:', err);
    return res.status(500).json({
      Message: '서버 에러',
      ResultCode: 'ERR_SERVER',
      Error: err.message || err.toString(),
    });
  }
}


// 유저의 예약 취소
// patch /facilities/reservation/{reservationId}
async function cancelReservation(req, res){
  try {
    const userId = req.user.id; // 로그인 유저
    const reservationId = parseInt(req.params.reservationId, 10);

    if (!userId) { // 로그인
      return res.status(401).json({
        Message: 'Unauthorized - 로그인 필요',
        ResultCode: 'ERR_UNAUTHORIZED',
      });
    }

    if (isNaN(reservationId)) { 
      return res.status(400).json({
        Message: '유효하지 않은 reservationId',
        ResultCode: 'ERR_INVALID_PARAMETER',
      });
    }

    // 예약 조회 (로그인한 유저 소유)
    const reservation = await models.reservation.findOne({
      where: { id: reservationId, user_id: userId }
    });

    if (!reservation) {
      return res.status(404).json({
        Message: '예약을 찾을 수 없습니다.',
        ResultCode: 'ERR_NOT_FOUND',
      });
    }

    // PENDING 상태가 아니면 취소 불가
    if (reservation.status !== 'PENDING') {
      return res.status(400).json({
        Message: '예약 상태가 PENDING이 아니면 취소할 수 없습니다.',
        ResultCode: 'ERR_CANNOT_CANCEL',
        currentStatus: reservation.status
      });
    }

    // 상태 변경
    reservation.status = 'CANCELED';
    await reservation.save();

    return res.status(200).json({
      Message: '예약이 취소되었습니다.',
      ResultCode: 'OK',
      data: { 
        reservation_id: reservation.id, 
        status: reservation.status 
      }
    });

  } catch (err) {
    console.error('cancelReservation error:', err);
    return res.status(500).json({
      Message: '서버 에러',
      ResultCode: 'ERR_SERVER',
      Error: err.message || err.toString(),
    });
  }
}



module.exports = { 
    createReservation,
    getReservations,
    getReservationDetail,
    cancelReservation
};