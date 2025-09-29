// routes/rest/user/index.js
const express = require('express');
const router = express.Router();




// /user/sns/login 라우팅
router.use('/login', require('./login')); 



module.exports = router;
