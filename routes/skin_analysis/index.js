//User-related routing page (/user*)

const express = require("express");
const router = express.Router();
const multer = require("multer");
const upload = multer(); // 메모리 저장

const { predictDisease } = require("./skin_analysis");

router.post("/", upload.single("image"), predictDisease);

module.exports = router;
