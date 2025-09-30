var express = require("express");
var router = express.Router();

//list of REST routing prefixes
router.use("/", require("./rest"));
router.use("/facility", require("./rest/facility"));
// router.use('/reservation', require('./reservation'));
// router.use('/review', require('./review'));
router.use("/user", require("./rest/user"));
router.use("/voice", require("./rest/voice"));

module.exports = router;
