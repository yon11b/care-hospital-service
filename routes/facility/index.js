const express = require("express");
const router = express.Router();
const multer = require("multer");
const aws = require("aws-sdk");
const multerS3 = require("multer-s3");
const path = require("path");
//require('dotenv').config();

const db = require("../../models");
const config = require("../../config/config.json")[
  process.env.NODE_ENV || "development"
];

const { authMiddleware } = require("../../middleware/authMiddleware.js");
const { requireRole } = require("../../middleware/requireRole.js");

aws.config.update({
  region: process.env.AWS_S3_REGION,
  accessKeyId: process.env.AWS_S3_ACCESS_KEY,
  secretAccessKey: process.env.AWS_S3_SECRET_KEY,
});

const s3 = new aws.S3();
const upload = multer({
  storage: multerS3({
    s3: s3,
    bucket: process.env.AWS_BUCKET,
    contentType: multerS3.AUTO_CONTENT_TYPE,
    key: (req, file, callback) => {
      //console.log(req.body.today_meal_url);
      const ext = path.extname(file.originalname);
      const uniqueKey = `image/meal-${Date.now()}-${Math.floor(Math.random() * 10000)}${ext}`;
      callback(null, uniqueKey);
    },
  }),
});
const {
  getFacility,
  getFacilities,
  upsertFacility,
  upsertMeal,
  getMeals,
  upsertNotice,
  deleteNotice,
  getNotice,
  getNotices,
  findFacilities,
} = require("./facility");
const {
  createReservation,
  getReservations,
  getReservationDetail,
  cancelReservation,

  getFacilityReservations,
  getFacilityReservationDetail,
  updateFacilityReservationStatus,
} = require("./reservation");
const {
  createAd,
  updateAd,
  getAds,
  getAdDetail,
} = require("./advertisement.js");
const {
  getPatientStatistics,
  updatePatientStatistics,
  getReservationStatistics,
  getChatStatistics,

  getFacilityStatistics,
  getLatestReservations,
  getLatestChats,
  getMonthlyCharts,
} = require("./statistics");

router.get("/:id", getFacility);
router.get("/", getFacilities);
const uploadMeals = upload.fields([
  { name: "breakfast_meal_picture_url", maxCount: 1 },
  { name: "lunch_meal_picture_url", maxCount: 1 },
  { name: "dinner_meal_picture_url", maxCount: 1 },
  { name: "week_meal_picture_url", maxCount: 1 },
]);
router.post("/:facilityid/dashboard", upsertFacility);
router.post("/:facilityid/dashboard/meals", uploadMeals, upsertMeal);
router.get("/:facilityid/meals", getMeals);

router.get("/:facilityid/dashboard/notices/:notyid", getNotice);
router.get("/:facilityid/dashboard/notices", getNotices);
router.post(
  "/:facilityid/dashboard/notices",
  upload.single("notification_picture_url"),
  upsertNotice
);
router.delete("/:facilityid/dashboard/notices/:notyid", deleteNotice);

// 사용자의 예약 기능
router.post("/:facilityId/reservation", authMiddleware, createReservation); // 예약하기
router.get("/reservations/list", authMiddleware, getReservations); // 예약 전체 조회
router.get(
  "/reservations/:reservationId",
  authMiddleware,
  getReservationDetail
); // 예약 상세 조회
router.patch("/reservations/:reservationId", authMiddleware, cancelReservation); // 예약 상세 조회

// 기관의 예약 관련 기능
router.get(
  "/:facilityId/dashboard/reservations",
  requireRole(["staff", "owner", "admin"]),
  getFacilityReservations
); // 기관의 예약 조회
router.get(
  "/:facilityId/dashboard/reservations/:reservationId",
  requireRole(["staff", "owner", "admin"]),
  getFacilityReservationDetail
); // 기관의 예약 상세 조회
router.patch(
  "/:facilityId/dashboard/reservations/:reservationId/:status",
  requireRole(["staff", "owner", "admin"]),
  updateFacilityReservationStatus
); // 기관의 예약 승인/거절

// 기관의 광고 신청 관련 기능
router.get(
  "/:facilityId/dashboard/advertisements/:adId",
  requireRole(["staff", "owner", "admin"]),
  getAdDetail
); // 기관의 광고 상세 조회
router.get(
  "/:facilityId/dashboard/advertisements",
  requireRole(["staff", "owner", "admin"]),
  getAds
); // 기관의 광고 목록 조회
router.post(
  "/:facilityId/dashboard/advertisements",
  requireRole(["staff", "owner", "admin"]),
  createAd
); // 기관의 광고 신청
router.patch(
  "/:facilityId/dashboard/advertisements/:adId",
  requireRole(["staff", "owner", "admin"]),
  updateAd
); // 기관의 광고 수정

// 기관의 통계 기능
router.get(
  "/:facilityId/overview/statistics",
  requireRole(["staff", "owner", "admin"]),
  getFacilityStatistics
); // 대시보드 overview 페이지 통계
router.get(
  "/:facilityId/overview/latest-reservations",
  requireRole(["staff", "owner", "admin"]),
  getLatestReservations
); // 대시보드 overview 페이지 최신 예약 5개
router.get(
  "/:facilityId/overview/latest-chats",
  requireRole(["staff", "owner", "admin"]),
  getLatestChats
); // 대시보드 overview 페이지 최신 상담 5개
router.get(
  "/:facilityId/overview/monthly-charts",
  requireRole(["staff", "owner", "admin"]),
  getMonthlyCharts
); // 대시보드 overview 페이지 월별 집계 차트

router.get(
  "/:facilityId/dashboard/statistics/patients",
  requireRole(["staff", "owner"]),
  getPatientStatistics
); // 환자 통계
router.patch(
  "/:facilityId/dashboard/statistics/patients",
  requireRole(["staff", "owner"]),
  updatePatientStatistics
); // 환자 통계 수정하기
router.get(
  "/:facilityId/dashboard/statistics/reservations",
  requireRole(["staff", "owner"]),
  getReservationStatistics
); // 예약 통계
router.get(
  "/:facilityId/dashboard/statistics/chats",
  requireRole(["staff", "owner"]),
  getChatStatistics
); // 상담 통계

router.get("/dashboard/find", findFacilities);
module.exports = router;
