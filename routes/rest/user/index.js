//User-related routing page (/rest/user*)

const express = require('express');
const router = express.Router();

const { getSession, upsertUser, approveFacility, login, logout } = require('./user');

router.get('/session', getSession);
router.post('/', upsertUser);
router.post('/approveFacility', approveFacility);
router.post('/login', login);
router.post('/logout', logout);
//router.post('/checkFacility', checkFacility);

module.exports = router;
    