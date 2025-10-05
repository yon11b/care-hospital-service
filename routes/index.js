var express = require("express");
const models = require("../models");
var router = express.Router();

//list of REST routing prefixes
//router.use("/", require("./"));
router.use("/facilities", require("./facility"));
// router.use('/reservation', require('./reservation'));
router.use("/user", require("./user"));
router.use("/voice", require("./voice"));

router.use("/community", require("./community"));
router.use("/user", require("./user"));
router.use("/reviews", require("./reviews"));
router.use("/exam", require("./exam"));

module.exports = router;
