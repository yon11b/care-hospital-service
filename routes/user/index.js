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

router.get("/session", getSession);
router.post("/", upsertUser);
router.post("/approveFacility", approveFacility);
router.post("/login", login);
router.post("/logout", logout);
//router.post('/checkFacility', checkFacility);
router.use('/sns', require('./sns')); 

router.get('/:userId/favorites', authMiddleware, getfavorites);
router.post('/:userId/favorites/:facilityId', authMiddleware, toggleFavorite);

module.exports = router;
