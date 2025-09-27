const express = require('express');
const router = express.Router();
const multer = require('multer');
const aws = require('aws-sdk');
const multerS3 = require('multer-s3');
const path = require('path');
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
      console.log('================');
      console.log(file);
      console.log(ext);
      // 콜백 함수 두 번째 인자에 파일명(경로 포함)을 입력
      callback(null, `image/meal-${Date.now()}_${ext}`);
    },
  }),
});

const { getFacility, getFacilities, upsertFacility } = require('./facilities');

router.get('/:id', getFacility);
router.get('/', getFacilities);

const mealUpload = upload.fields([
  { name: 'breakfast_meal_picture_url', maxCount: 1 },
  { name: 'lunch_meal_picture_url', maxCount: 1 },
  { name: 'dinner_meal_picture_url', maxCount: 1 },
  { name: 'week_meal_picture_url', maxCount: 1 },
]);

router.post('/:facilityid/dashboard', mealUpload, upsertFacility);
//router.post('/:facilityid', upsertFacility);
//router.get('/gps', getFacilities);
//router.post('/', upload.single('file-front'), upsertFacility);

module.exports = router;
