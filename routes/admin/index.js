const express = require("express");
const router = express.Router();

//require('dotenv').config();
const { requireRole } = require("../../middleware/requireRole.js");

const {
  getReports,
  getReportDetail,
  handleReportApproved,
  handleReportRejected,
} = require("./report");
const {
  addUserToBlacklist,
  removeUserFromBlacklist,
  getUsersList,
  getUserDetail,

  getStaffsList,
  getFacilitiesList,
  getFacilityStaffs,
  updateStaffStatus,
  updateUserStatus,
} = require("./member");
const {
  getReservationStatistics,
  getMonthlyUsers,
  getActiveUsers,
  getUsers,
  getDatas,
} = require("./statistics");
const { getReviews, getReview, updateReview } = require("./review");

const {
  getCommunities,
  getCommunity,
  updateCommunity,
} = require("./community");
const {
  getFacilityAds,
  getFacilityAdsDetail,
  approveOrRejectAd,
} = require("./advertisement");

const { getFacilities, getFacility } = require("./facility");

const { getAnomalies } = require("./anomaly");
// 1. 신고 관련 기능
// admin 로그인 세션 확인 -> 미들웨어(requireRole)로 체크
router.get("/reports", requireRole(["admin"]), getReports); // 신고 목록 조회
router.get("/reports/:reportId", requireRole(["admin"]), getReportDetail); // 신고 상세 조회
router.patch(
  "/reports/:reportId/approved",
  requireRole(["admin"]),
  handleReportApproved
); // 신고 승인
router.patch(
  "/reports/:reportId/rejected",
  requireRole(["admin"]),
  handleReportRejected
); // 신고 거절

// 2. 블랙리스트 관련 기능
router.post("/user/:userId/block", requireRole(["admin"]), addUserToBlacklist); // 블랙리스트 등록
router.delete(
  "/user/:userId/block",
  requireRole(["admin"]),
  removeUserFromBlacklist
); // 블랙리스트 해제

// 3. 회원 관리 - 회원(사용자/기관) 목록 조회
router.get("/members/users", requireRole(["admin"]), getUsersList); // 사용자 목록
router.get("/members/users/:userId", requireRole(["admin"]), getUserDetail); // 사용자 상세 보기
router.get("/members/staffs", requireRole(["admin"]), getStaffsList); // 회원(기관 대표, 직원) 목록 조회
router.get("/members/facilities", requireRole(["admin"]), getFacilitiesList);
router.get(
  "/members/facilities/:facilityId",
  requireRole(["admin"]),
  getFacilityStaffs
);
router.post("/members/staffs", requireRole(["admin"]), updateStaffStatus);
router.post("/members/users", requireRole(["admin"]), updateUserStatus);

// 4. 통계
router.get(
  "/statistics/monthly-users",
  requireRole(["admin"]),
  getMonthlyUsers
);
router.get(
  "/statistics/reservations",
  requireRole(["admin"]),
  getReservationStatistics
);
router.get(
  "/statistics/monthly-active-users",
  requireRole(["admin"]),
  getActiveUsers
);
// 4. 리뷰
router.get("/reviews", requireRole(["admin"]), getReviews);
router.get("/reviews/:id", requireRole(["admin"]), getReview);
router.patch("/reviews/:id", requireRole(["admin"]), updateReview);

router.get("/statistics/users", requireRole(["admin"]), getUsers);
router.get("/statistics/datas", requireRole(["admin"]), getDatas);

// 5. 광고
router.get("/advertisements", requireRole(["admin"]), getFacilityAds);
router.get(
  "/advertisements/:adId",
  requireRole(["admin"]),
  getFacilityAdsDetail
);
router.patch(
  "/advertisements/:adId",
  requireRole(["admin"]),
  approveOrRejectAd
);

// 6. 이상탐지
router.get("/anomaly", requireRole(["admin"]), getAnomalies);

// 7. 시설
router.get("/facilities", requireRole(["admin"]), getFacilities);
router.get("/facilities/:id", requireRole(["admin"]), getFacility);

// 8. 커뮤니티
router.get("/communities", requireRole(["admin"]), getCommunities);
router.get("/communities/:id", requireRole(["admin"]), getCommunity);
router.patch("/communities/:id", requireRole(["admin"]), updateCommunity);

module.exports = router;
