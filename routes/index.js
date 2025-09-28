//Default routing page (/rest*)

const express = require('express');
const models = require('../models');
const sha256 = require('sha256');
const router = express.Router();


// community 라우터로 가라.
router.use('/community', require('./community')); 
// user 라우터로 가라.
router.use('/user', require('./user')); 

module.exports = router;
