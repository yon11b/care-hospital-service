const express = require('express');
const models = require('../models');
const sha256 = require('sha256');
const router = express.Router();


router.use('/community', require('./community')); 
router.use('/user', require('./user')); 
router.use('/reviews', require('./reviews')); 

module.exports = router;