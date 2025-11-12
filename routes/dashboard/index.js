const express = require("express");
const router = express.Router();

const { getActiveUsers, getNewUsers } = require("./user");
const { getReportedReviews, handleReportedReview } = require("./report");
const { getDatas } = require("./data");

router.get("/monthly-active-users", getActiveUsers);
router.get("/new-users", getNewUsers);
router.get("/reports", getReportedReviews);
router.post("/reports/:reportId", handleReportedReview);

router.get("/datas", getDatas);
module.exports = router;
