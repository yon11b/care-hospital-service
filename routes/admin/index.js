const express = require("express");
const router = express.Router();
const multer = require("multer");
const aws = require("aws-sdk");
const multerS3 = require("multer-s3");
const path = require("path");
//require('dotenv').config();
const { requireRole } = require('../../middleware/requireRole.js');


const {
    getReports,
    getReportDetail,
    handleReportApproved,
    handleReportRejected,

} = require("./admin");

// 1. 신고 관련 기능     
// admin 로그인 세션 확인 -> 미들웨어(requireRole)로 체크
router.get('/reports', requireRole("admin"), getReports); // 신고 목록 조회
router.get('/reports/:reportId', requireRole("admin"), getReportDetail); // 신고 상세 조회
router.patch('/reports/:reportId/approved', requireRole("admin"), handleReportApproved); // 신고 승인
router.patch('/reports/:reportId/rejected', requireRole("admin"), handleReportRejected); // 신고 거절

module.exports = router;
