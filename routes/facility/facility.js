const models = require('../../models');
const sha256 = require('sha256');
const app = require('../../app');
const Sequelize = require('sequelize');
const AWS = require('aws-sdk');
const { Op } = require('sequelize');

// 예약하기 -> 예약 프로세스 여쭤보고 작성하기
// ===============================
// 1. 예약 화면 진입 하기
// -> ex) 누가 예약하나요? 본인 VS 보호자
// GET /facilities/:facilityId/reservation/init
// ===============================
// 예약 화면 초기 화면 제공
async function getReservationInitPage(req, res) {
  try {
    const userId = req.user.id; // JWT에서 사용자 ID
    const { facilityId } = req.params;

    // 로그인 확인
    if(!userId){
        return res.status(401).send({
        Message: 'Unauthorized - 로그인 필요',
        ResultCode: 'ERR_UNAUTHORIZED',
      });
    }
    // 파라미터 체크
    if (!facilityId) {
        return res.status(400).json({
            Message: 'Facility ID가 필요합니다.',
            ResultCode: 'ERR_BAD_REQUEST',
        });
    }
    // DB에서 해당 시설 존재 여부 확인
    const facility = await models.facility.findByPk(facilityId);
    if (!facility) {
      return res.status(404).json({
        Message: '시설을 찾을 수 없습니다.',
        ResultCode: 'ERR_NOT_FOUND',
      });
    }    

    // 예약 초기 화면 데이터
    const initData = {
        question: "누가 예약하나요?",
        options: [
            { code: 'SELF', label: '본인' },
            { code: 'GUARDIAN', label: '보호자' }
        ]
    };    
    // 응답
    return res.status(200).json({
        Message: '예약 초기 화면 데이터',
        ResultCode: 'OK',
        Data: initData
    });

  } catch (err) {
    console.error('getReservationInitPage error:', err);
    return res.status(500).json({
      Message: 'Internal server error',
      ResultCode: 'ERR_INTERNAL_SERVER',
      msg: err.toString(),
    });
  }
}



// ===============================
// 2. 예약 정보 입력 단계 - 환자 정보 입력 화면 보여주기
// 환자의 정보 입력
// GET /facilities/:facilityId/reservation/form?for=SELF|GUARDIAN
// ===============================
// GET /facilities/:facilityId/reservation/form?for=SELF|GUARDIAN
async function getReservationForm(req, res) {
 
}



module.exports = {
    

};