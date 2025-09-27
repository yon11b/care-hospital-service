var express = require('express');
var router = express.Router();

//list of REST routing prefixes
router.use('/rest', require('./rest'));
router.use('/rest/facilities', require('./rest/facilities'));
// router.use('/rest/reservation', require('./rest/reservation'));
// router.use('/rest/review', require('./rest/review'));
router.use('/rest/user', require('./rest/user'));
router.use('/rest/voice', require('./rest/voice'));

module.exports = router;
