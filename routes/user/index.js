// routes/rest/user/index.js
const express = require('express');
const router = express.Router();




// /rest/user/sns 라우팅
router.use('/sns', require('./sns')); 



module.exports = router;

