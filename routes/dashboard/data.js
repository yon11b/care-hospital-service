// routes/dashboard.js
const express = require("express");
const router = express.Router();
const { facility, user, review, community } = require("../../models"); // Sequelize 모델 import

// GET /dashboard/data
async function getDatas(req, res) {
  try {
    // 각 테이블 카운트
    const [facilityCount, userCount, reviewCount, communityCount] =
      await Promise.all([
        facility.count(),
        user.count(),
        review.count(),
        community.count(),
      ]);

    return res.json({
      Message: "Datas select successfully.",
      ResultCode: "ERR_OK",
      counts: {
        facilities: facilityCount,
        users: userCount,
        reviews: reviewCount,
        communities: communityCount,
      },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      Message: "서버 에러",
      ResultCode: "ERR_INTERNAL",
    });
  }
}

module.exports = { getDatas };
