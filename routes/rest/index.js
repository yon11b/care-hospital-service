//Default routing page (/rest*)

const express = require('express');
const models = require('../../models');
const sha256 = require('sha256');
const router = express.Router();

//유저 관련 함수들이지만 앞에 /user가 안붙는 경우 해당 함수만 가져오고 라우팅은 이 파일에서 함

module.exports = router;
