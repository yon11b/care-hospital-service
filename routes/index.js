var express = require("express");
const models = require("../models");
var router = express.Router();

//list of REST routing prefixes
//router.use("/", require("./"));
router.use("/facilities", require("./facility"));
// router.use('/reservation', require('./reservation'));
// router.use('/review', require('./review'));
router.use("/user", require("./user"));
router.use("/voice", require("./voice"));
router.use("/predictDisease", require("./skin_analysis"));

router.use('/community', require('./community')); 
router.use('/reviews', require('./reviews')); 
router.use('/admin', require('./admin')); 

module.exports = router;