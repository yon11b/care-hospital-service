const express = require("express");
const router = express.Router();
//require('dotenv').config();

const { searchFacilities } = require("./voicesearch");

router.post("/voice", searchFacilities);

module.exports = router;
