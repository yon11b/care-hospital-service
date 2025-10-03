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



const {
  createReservation,
  getReservations,
  getReservationDetail,
  cancelReservation
} = require("./reservation");

router.post('/:facilityId/reservation', authMiddleware, createReservation); // 예약하기
router.get('/reservation', authMiddleware, getReservations); // 예약 전체 조회
router.get('/reservation/:reservationId', authMiddleware, getReservationDetail); // 예약 상세 조회
router.patch('/reservation/:reservationId', authMiddleware, cancelReservation); // 예약 상세 조회
module.exports = router;