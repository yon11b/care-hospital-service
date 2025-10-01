const express = require("express");
const router = express.Router();
const multer = require("multer");
const aws = require("aws-sdk");
const multerS3 = require("multer-s3");
const path = require("path");
//require('dotenv').config();

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

module.exports = router;
