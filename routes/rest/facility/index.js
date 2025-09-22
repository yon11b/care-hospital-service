const express = require('express');
const router = express.Router();
//const multer = require('multer');
const path = require('path');
const db = require('../../../models');
const config = require('../../../config/config.json')[process.env.NODE_ENV || 'development'];
// const storage = multer.diskStorage({
//   destination: (req, file, cb) => {
//     cb(null, config.path.upload_path);
//   },
//   filename: (req, file, cb) => {
//     const extension = path.extname(file.originalname);
//     const basename = path.basename(file.originalname, extension);
//     cb(null, basename + '-' + Date.now() + extension);
//   },
// });

// const upload = multer({
//   storage: storage,
// });

const { getFacility, getFacilities, upsertFacility } = require('./facility');

router.get('/:id', getFacility);
router.get('/', getFacilities);
//router.get('/gps', getFacilities);
//router.post('/', upload.single('file-front'), upsertFacility);

module.exports = router;
