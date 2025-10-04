const models = require("../../models");
const sha256 = require("sha256");
const { literal, Op } = require("sequelize");
const app = require("../../app");

// =================================
// 1. 신고 관리
// =================================
// 1-1. 신고 목록 보여주기
// GET /admin/reports
// 페이징 처리까지 고려해서 번호 눌러서 볼 수 있는 방식
async function getReports(req, res) {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const offset = (page - 1) * limit;

    // admin 로그인 세션 확인 -> 미들웨어로 체크
    
    const where = {};
    if (req.query.status){ // 신고 상태로 필터링 
        where.status = req.query.status;
    }

    // 총 신고 수 확인 (페이징용)
    const totalReports = await models.report.count({ where });

    // 신고 목록 조회
    const reports = await models.report.findAll({
      where,
      order: [['created_at', 'DESC']], // 최신순
      offset,
      limit,
      include: [
        { model: models.user, attributes: ['id', 'name'] }, // 신고자 이름
      ],
    });

    // 총 페이지 계산
    const totalPages = Math.ceil(totalReports / limit);

    res.status(200).json({ 
        Message: '신고 전체 내역 조회 성공',
        ResultCode: 'SUCCESS',
        data:{
            page, 
            totalPages, 
            totalReports, 
            reports
        }
    });

  } catch (err) {
    console.error('admin - getReports err:', err.message);
    res.status(500).json({ 
      Message: 'Internal server error',
      ResultCode: 'ERR_INTERNAL_SERVER',
      msg: err.toString(),
    });
  }
}
// 1-2. 신고 상세 보기 ()
// GET /admin/reports/:reportId
async function getReportDetail(req, res) {
  try {
    const reportId = parseInt(req.params.reportId, 10); 
  
    // admin 로그인 세션 확인 -> 미들웨어로 체크
  
    const report = await models.report.findOne({
      where: { id: reportId },
      include: [
        { model: models.user, attributes: ['id', 'name'] }, // 신고자
      ],
    });

    if (!report) return res.status(404).json({ 
        Message: '신고 내역이 존재하지 않습니다.',
        ResultCode: 'ERR_NOT_FOUND',
    });

    // target 정보 가져오기
    let target = null;
    switch (report.type) {
      case 'REVIEW':
        target = await models.review.findByPk(report.target_id);
        break;
      case 'COMMUNITY':
        target = await models.community.findByPk(report.target_id);
        break;
      case 'COMMENT':
        target = await models.comment.findByPk(report.target_id);
        break;
    }

    res.status(200).json({ 
        Message: '신고 상세 내역 조회 성공',
        ResultCode: 'SUCCESS',
        data:{
            report, 
            target 
        }
    });
  } catch (err) {
    console.error('admin - getReportDetail err:', err.message);
    res.status(500).json({ 
      Message: 'Internal server error',
      ResultCode: 'ERR_INTERNAL_SERVER',
      msg: err.toString(),
    });
  }
}
// 1-3. 신고 처리하기 - 승인
// patch /admin/reports/:reportId/approved
// report 상태 : PENDING -> APPROVED( 대상 삭제 )
// 리뷰, 커뮤니티, 댓글 상태: PEPORT_PENDING -> DELETED
async function handleReportApproved(req, res) {
  try {
    const { reportId } = req.params; 

    // admin 로그인 세션 확인 -> 미들웨어로 체크

    // 1. 신고 조회
    const foundReport = await models.report.findByPk(reportId);
    if (!foundReport) {
      return res.status(404).json({ 
        Message: '신고 내역이 존재하지 않습니다.',
        ResultCode: 'ERR_NOT_FOUND_REPORT',
      });
    }
    
    // 2. 신고 상태 확인
    if (foundReport.status !== 'PENDING') {
      return res.status(400).json({ 
        Message: '신고가 이미 처리되었습니다.', 
        ResultCode : 'ERR_ALREADY_PROCESSED'
      });
    }

    // 3. 대상 모델 결정
    let targetModel;
    switch (foundReport.type) {
      case 'REVIEW': targetModel = models.review; break;
      case 'COMMUNITY': targetModel = models.community; break;
      case 'COMMENT': targetModel = models.comment; break;
      default:
        return res.status(400).json({ 
          Message: 'Invalid report type', 
          ResultCode : 'ERR_INVALID_TYPE'
        });
    }

    // 4. 대상 조회
    const target = await targetModel.findByPk(foundReport.target_id);
    if (!target) {
      return res.status(404).json({ 
        Message: '신고 대상이 존재하지 않습니다.',
        ResultCode : 'ERR_NOT_FOUND_REPORT_TARGET'
      });
    }

    // 5. 신고 대상의 상태 확인
    if (target.status !== 'REPORT_PENDING') {
      return res.status(400).json({
        Message: '신고 대상이 처리 가능한 상태가 아닙니다.',
        ResultCode: 'ERR_TARGET_NOT_REPORT_PENDING'
      });
    }

    // 6. 승인 처리
    // 신고 상태 : PENDING -> APPROVED
    foundReport.status = 'APPROVED';
    await foundReport.save();

    // 신고 대상 상태 : REPORT_PENDING -> DELETED    
    target.status = 'DELETED';
    target.deleted_at = new Date();
    await target.save();
    
    return res.json({
      Message: '신고가 승인 처리되었습니다.',
      ResultCode: 'SUCCESS',
      data: { report: foundReport, target }
    });


  } catch (err) {
    console.error('admin - handleReportApproved err:', err.message);
    res.status(500).json({ 
      Message: 'Internal server error',
      ResultCode: 'ERR_INTERNAL_SERVER',
      msg: err.toString(),
    });
  }
}
// 1-4. 신고 처리하기 - 거절/반려
// patch /admin/reports/:reportId/rejected
// report 상태 : PENDING -> REJECTED (대상 유지됨)
// 리뷰, 커뮤니티, 댓글 상태: PEPORT_PENDING ->  ACTION
async function handleReportRejected(req, res) {
  try {
    const { reportId } = req.params;

    // admin 로그인 세션 확인 -> 미들웨어로 체크
    
    // 1. 신고 조회
    const foundReport = await models.report.findByPk(reportId);
    if (!foundReport) {
      return res.status(404).json({
        Message: '신고 내역이 존재하지 않습니다.',
        ResultCode: 'ERR_NOT_FOUND_REPORT',
      });
    }

    // 2. 신고 상태 확인
    if (foundReport.status !== 'PENDING') {
      return res.status(400).json({
        Message: '신고가 이미 처리되었습니다.',
        ResultCode: 'ERR_ALREADY_PROCESSED',
      });
    }

    // 3. 대상 모델 결정
    let targetModel;
    switch (foundReport.type) {
      case 'REVIEW':
        targetModel = models.review;
        break;
      case 'COMMUNITY':
        targetModel = models.community;
        break;
      case 'COMMENT':
        targetModel = models.comment;
        break;
      default:
        return res.status(400).json({
          Message: 'Invalid report type',
          ResultCode: 'ERR_INVALID_TYPE',
        });
    }

    // 4. 대상 조회
    const target = await targetModel.findByPk(foundReport.target_id);
    if (!target) {
      return res.status(404).json({
        Message: '신고 대상이 존재하지 않습니다.',
        ResultCode: 'ERR_NOT_FOUND_REPORT_TARGET',
      });
    }

    // 5. 신고 대상의 상태 확인
    if (target.status !== 'REPORT_PENDING') {
      return res.status(400).json({
        Message: '신고 대상이 처리 가능한 상태가 아닙니다.',
        ResultCode: 'ERR_TARGET_NOT_REPORT_PENDING'
      });
    }

    // 6. 거절 처리    
    // 신고 상태 : PENDING -> REJECTED
    foundReport.status = 'REJECTED';
    await foundReport.save();
    // 신고 대상 상태 : REPORT_PENDING -> ACTION   
    target.status = 'ACTION';
    await target.save();


    return res.json({
      Message: '신고가 거절 처리되었습니다.',
      ResultCode: 'SUCCESS',
      data: { report: foundReport, target },

    });

  } catch (err) {
    console.error('admin - handleReportRejected err:', err.message);
    res.status(500).json({
      Message: 'Internal server error',
      ResultCode: 'ERR_INTERNAL_SERVER',
      msg: err.toString(),
    });
  }
}





module.exports = { 
    getReports,
    getReportDetail,
    handleReportApproved,
    handleReportRejected
};