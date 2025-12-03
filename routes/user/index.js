//User-related routing page (/user*)

const express = require("express");
const router = express.Router();
const db = require("../../models");
const config = require("../../config/config.json")[
  process.env.NODE_ENV || "development"
];
const solapi = require("solapi");

const { authMiddleware } = require("../../middleware/authMiddleware.js");

const {
  getSession,
  updateUser,
  createUser,
  login,
  logout,
  geolocation,
  checkStaff,
  getJwtDetails,
} = require("./user");
const { getfavorites, toggleFavorite } = require("./favorite");
const { makeSnsAuthUrl, handleCallback, refreshToken } = require("./sns");

const { sendMessage, verifyAndLogin } = require("./phone");

router.get("/session", getSession);
router.post("/register/staff", createUser);
router.patch("/me", updateUser);
//router.post("/approveFacility", approveFacility); // 관리자 승인. 플랫폼 관리자 기능임.
router.post("/login", login);
router.post("/logout", logout);
//router.post("/checkFacility", checkFacility); // 사업자등록번호, 요양기호 검증
router.post("/checkStaff", checkStaff); // 직원의 토큰 검증

router.get("/:userId/favorites", authMiddleware, getfavorites);
router.post("/:userId/favorites/:facilityId", authMiddleware, toggleFavorite);

// 앱에서 로그인 버튼 클릭 → 로그인 페이지로 리다이렉트
router.get("/sns/login/:provider", makeSnsAuthUrl);
// 각 sns callback 라우트
router.get("/sns/login/naver/callback", (req, res) =>
  handleCallback(req, res, "naver")
);
router.get("/sns/login/kakao/callback", (req, res) =>
  handleCallback(req, res, "kakao")
);
router.get("/sns/login/google/callback", (req, res) =>
  handleCallback(req, res, "google")
);
// refresh token 재발급
router.post("/sns/login/refresh-token", refreshToken); // Refresh token 재발급 (POST)

// 사용자가 입력한 주소로 위도, 경도 리턴
router.get("/geolocation", geolocation);

// 전화번호 문자 발송
router.post("/phone/send", sendMessage); // 코드 문자 전송
router.post("/phone/verify", verifyAndLogin); // 코드 인증 및 로그인/회원가입

// refreshtoken으로 유저 정보 받기

// jwt로 유저 정보 받기
router.get("/jwt/detail", authMiddleware, getJwtDetails);

module.exports = router;
