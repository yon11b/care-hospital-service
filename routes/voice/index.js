const express = require("express");
const router = express.Router();
//const multer = require('multer');

const { transcribe, quickstart } = require("./voice");

router.post("/transcribe", transcribe);
router.get("/", quickstart);

module.exports = router;
