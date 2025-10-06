const models = require("../../models");
const sha256 = require("sha256");
const { Op } = require("sequelize");
const app = require("../../app");


// ========================================
// 1. 회원(기관) 목록 조회 및 상세 조회
// ========================================
// 1-1. 회원(기관 대표, 직원) 목록 조회
// GET /admin/members/facilities
async function getStaffsList(req, res) {
  try {
    // 관리자 로그인 및 권한 체크는 미들웨어에서 처리됨


  } catch (err) {
    console.error('admin - getStaffsList err:', err.message);
    res.status(500).json({
      Message: 'Internal server error',
      ResultCode: 'ERR_INTERNAL_SERVER',
      msg: err.toString(),
    });
  }
}

module.exports = { 
    getStaffsList,
};