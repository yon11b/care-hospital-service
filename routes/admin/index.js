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
} = require("./report.js");
const {
    addUserToBlacklist,
    removeUserFromBlacklist,
    getUsersList,
    getUserDetail,

    getStaffsList,
    getFacilitiesList,
    getFacilityStaffs
} = require("./member.js");

// 1. 신고 관련 기능     
// admin 로그인 세션 확인 -> 미들웨어(requireRole)로 체크
router.get('/reports', requireRole("admin"), getReports); // 신고 목록 조회
router.get('/reports/:reportId', requireRole("admin"), getReportDetail); // 신고 상세 조회
router.patch('/reports/:reportId/approved', requireRole("admin"), handleReportApproved); // 신고 승인
router.patch('/reports/:reportId/rejected', requireRole("admin"), handleReportRejected); // 신고 거절

// 2. 블랙리스트 관련 기능
router.post('/user/:userId/block', requireRole("admin"), addUserToBlacklist); // 블랙리스트 등록
router.delete('/user/:userId/block', requireRole("admin"), removeUserFromBlacklist); // 블랙리스트 해제

// 3. 회원 관리 - 회원(사용자/기관) 목록 조회
router.get('/members/users', requireRole("admin"), getUsersList); // 사용자 목록
router.get('/members/users/:userId', requireRole("admin"), getUserDetail); // 사용자 상세 보기
router.get('/members/staffs', requireRole("admin"), getStaffsList); // 회원(기관 대표, 직원) 목록 조회
router.get('/members/facilities', requireRole("admin"), getFacilitiesList); 
router.get('/members/facilities/:facilityId', requireRole("admin"), getFacilityStaffs); 

// GET /admin/members/staffs
// GET /admin/members/facilities
// GET /admin/members/facilities/:facilityId



module.exports = router;
