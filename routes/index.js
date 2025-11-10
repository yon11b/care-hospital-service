var express = require("express");
const models = require("../models");
var router = express.Router();

//list of REST routing prefixes
//router.use("/", require("./"));
router.use("/facilities", require("./facility"));
// router.use('/reservation', require('./reservation'));
router.use("/user", require("./user"));

router.use("/community", require("./community"));
router.use("/reviews", require("./reviews"));
router.use("/admin", require("./admin"));
router.use("/exam", require("./exam"));
router.use("/search/voice", require("./voicesearch"));
router.use("/chats", require("./chats"));
router.use("/ecommerce", require("./ecommerce"));
module.exports = router;
