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
} = require("./facility");

router.post('/:facilityid/reservation', authMiddleware, createReservation); // 예약하기


module.exports = router;