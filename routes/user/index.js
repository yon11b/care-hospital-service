//User-related routing page (/user*)

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
  getSession,
  upsertUser,
  approveFacility,
  login,
  logout,
} = require("./user");
const {
  getfavorites,
  toggleFavorite
} = require("./favorite")
const {
	handleCallback,
  refreshToken
} = require("./sns")

router.get("/session", getSession);
router.post("/", upsertUser);
router.post("/approveFacility", approveFacility);
router.post("/login", login);
router.post("/logout", logout);
//router.post('/checkFacility', checkFacility);

router.get('/:userId/favorites', authMiddleware, getfavorites);
router.post('/:userId/favorites/:facilityId', authMiddleware, toggleFavorite);


// 각 sns callback 라우트
router.get('/sns/login/naver/callback', (req, res) => handleCallback(req, res, 'naver'));
router.get('/sns/login/kakao/callback', (req, res) => handleCallback(req, res, 'kakao'));


// refresh token 재발급
router.post('/sns/login/refresh-token', refreshToken); // Refresh token 재발급 (POST)


module.exports = router;
