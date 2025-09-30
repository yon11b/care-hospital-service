const express = require("express");
const router = express.Router();
//const multer = require('multer');

const { transcribe } = require("./voice");

router.post("/transcribe", transcribe);
//router.post('/', upload.single('file-front'), upsertFacility);

module.exports = router;
