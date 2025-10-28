const express = require("express");
const router = express.Router();
const multer = require("multer");
const aws = require("aws-sdk");
const multerS3 = require("multer-s3");
const path = require("path");
//require('dotenv').config();


const db = require('../../models');
const config = require('../../config/config.json')[process.env.NODE_ENV || 'development'];

const { authMiddleware } = require('../../middleware/authMiddleware.js');
const { requireRole } = require('../../middleware/requireRole.js');


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
      callback(null, `image/meal-${Date.now()}_${ext}`);
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
} = require("./facility");
const {
  createReservation,
  getReservations,
  getReservationDetail,
  cancelReservation,

  getFacilityReservations,
  getFacilityReservationDetail,
  updateFacilityReservationStatus
} = require("./reservation");
const {
  createAd,
  updateAd,
  getAdDetail,

} = require("./advertiesment");


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


// =======================
// 사용자의 예약 기능
// =======================
router.post('/:facilityId/reservation', authMiddleware, createReservation); // 예약하기
router.get('/reservations/list', authMiddleware, getReservations); // 예약 전체 조회
router.get('/reservations/:reservationId', authMiddleware, getReservationDetail); // 예약 상세 조회
router.patch('/reservations/:reservationId', authMiddleware, cancelReservation); // 예약 상세 조회

// =======================
// 기관의 예약 관련 기능
// =======================
router.get('/:facilityId/dashboard/reservations', requireRole(["staff", "owner"]), getFacilityReservations); // 기관의 예약 조회
router.get('/:facilityId/dashboard/reservations/:reservationId', requireRole(["staff", "owner"]), getFacilityReservationDetail); // 기관의 예약 상세 조회
router.patch('/:facilityId/dashboard/reservations/:reservationId/:status', requireRole(["staff", "owner"]), updateFacilityReservationStatus); // 기관의 예약 승인/거절

// =======================
// 기관의 광고 신청 관련 기능
// =======================
router.get('/:facilityId/dashboard/advertisements/:adId', requireRole(["staff", "owner"]), getAdDetail); // 기관의 광고 상세 조회
router.post("/:facilityId/dashboard/advertisements", requireRole(["staff", "owner"]), createAd) // 기관의 광고 신청
router.patch("/:facilityId/dashboard/advertisements/:adId", requireRole(["staff", "owner"]), updateAd) // 기관의 광고 수정


module.exports = router;
