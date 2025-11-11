// sns 회원가입, 로그인

const express = require("express");
const jwt = require("jsonwebtoken");
const router = express.Router();
const axios = require("axios");
const models = require("../../models"); // user, user_sns
const {
  generateToken,
  generateRefreshToken,
} = require("../../middleware/auth");
const { sequelize } = models; // 트랜잭션 사용
const { Op } = require("sequelize");

// SNS별 설정
const SNS_CONFIG = {
  naver: {
    clientId: process.env.NAVER_CLIENT_ID,
    clientSecret: process.env.NAVER_CLIENT_SECRET,
    redirectUri: process.env.NAVER_REDIRECT_URI_MOBILE,
    tokenUrl: "https://nid.naver.com/oauth2.0/token",
    profileUrl: "https://openapi.naver.com/v1/nid/me",
  },
  kakao: {
    clientId: process.env.KAKAO_CLIENT_ID,
    clientSecret: process.env.KAKAO_CLIENT_SECRET,
    redirectUri: process.env.KAKAO_REDIRECT_URI_MOBILE,
    tokenUrl: "https://kauth.kakao.com/oauth/token",
    profileUrl: "https://kapi.kakao.com/v2/user/me",
  },
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    redirectUri: process.env.GOOGLE_REDIRECT_URI_MOBILE,
    tokenUrl: "https://oauth2.googleapis.com/token",
    profileUrl: "https://www.googleapis.com/oauth2/v3/userinfo",
  },
};

// 서버에서 로그인 페이지 url 생성
// 앱에서 로그인 버튼을 클릭하면 로그인 페이지로 리다이렉트되도록 한다.
// 공통 SNS 로그인 URL 생성
async function makeSnsAuthUrl(req, res) {
  const { provider } = req.params; // 'naver', 'kakao', 'google'
  const config = SNS_CONFIG[provider];
  if (!config) return res.status(400).json({ message: "Unsupported provider" });

  const state = Math.random().toString(36).substring(2, 15);

  let url;

  switch (provider) {
    case "naver":
      url = `https://nid.naver.com/oauth2.0/authorize?response_type=code&client_id=${config.clientId}&redirect_uri=${encodeURIComponent(config.redirectUri)}&state=${state}`;
      break;
    case "kakao":
      url = `https://kauth.kakao.com/oauth/authorize?response_type=code&client_id=${config.clientId}&redirect_uri=${encodeURIComponent(config.redirectUri)}&state=${state}`;
      break;
    case "google":
      const scope = encodeURIComponent("openid email profile");
      url = `https://accounts.google.com/o/oauth2/v2/auth?response_type=code&client_id=${config.clientId}&redirect_uri=${encodeURIComponent(config.redirectUri)}&state=${state}&scope=${scope}`;
      break;
    default:
      return res.status(400).json({ message: "Unsupported provider" });
  }

  res.redirect(url);
}

// Access Token 발급 함수
// 앱에서 전달받은 code -> SNS 서버에서 access token 발급
async function getAccessToken(provider, code) {
  const config = SNS_CONFIG[provider]; // sns 별...

  if (!config) throw new Error("getAccessToken - Unsupported provider");

  switch (provider) {
    case "naver":
      const naverRes = await axios.post(
        config.tokenUrl,
        new URLSearchParams({
          grant_type: "authorization_code",
          client_id: config.clientId,
          client_secret: config.clientSecret,
          code,
          redirect_uri: config.redirectUri,
        }).toString(),
        {
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
        }
      );
      return naverRes.data.access_token;

    case "kakao":
      const kakaoRes = await axios.post(
        config.tokenUrl,
        new URLSearchParams({
          grant_type: "authorization_code",
          client_id: config.clientId,
          client_secret: config.clientSecret,
          code,
          redirect_uri: config.redirectUri,
        }).toString(),
        {
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
        }
      );
      return kakaoRes.data.access_token;

    case "google":
      const googleRes = await axios.post(
        config.tokenUrl,
        new URLSearchParams({
          grant_type: "authorization_code",
          client_id: config.clientId,
          client_secret: config.clientSecret,
          code,
          redirect_uri: config.redirectUri,
        }).toString(),
        {
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
        }
      );
      return googleRes.data.access_token;

    default:
      throw new Error("getAccessToken - Unsupported provider");
  }
}

// 사용자 프로필 조회 (name, email, phone)
async function getProfile(provider, accessToken) {
  const config = SNS_CONFIG[provider];
  const headers = { Authorization: `Bearer ${accessToken}` };
  const res = await axios.get(config.profileUrl, { headers });

  switch (provider) {
    case "naver":
      const naverProfile = res.data.response;
      return {
        id: naverProfile.id,
        name: naverProfile.name || null, // 본명
        email: naverProfile.email || null, // 이메일
        phone: naverProfile.mobile || null, // 전화번호
      };

    case "kakao":
      const kakaoProfile = res.data;
      return {
        id: kakaoProfile.id,
        name: kakaoProfile.kakao_account?.profile?.nickname || null, // 비즈니스 앱 필요 (본명)
        email: kakaoProfile.kakao_account?.email || null,
        phone: kakaoProfile.kakao_account?.phone_number || null, // 비즈니스 앱 필요
      };

    case "google":
      const googleProfile = res.data;
      return {
        id: googleProfile.sub,
        name: googleProfile.name || null, // 이름
        email: googleProfile.email || null, // 이메일
        phone: null,
      };

    default:
      throw new Error("getProfile - Unsupported provider");
  }
}

// 공통 callback 처리
// 앱에서 로그인 버튼 클릭 → SNS 인증 → callback URL 호출
async function handleCallback(req, res, provider) {
  const { code } = req.query; // code 받기

  try {
    // (1) code → access token (받아 온 코드를 이용해 sns 서버에서 토큰 발급)
    const accessToken = await getAccessToken(provider, code);

    // (2) access token → sns별 프로필 조회
    const profile = await getProfile(provider, accessToken);

    // (3) DB 조회 (user_sns 테이블 활용)
    let snsInstance = await models.user_sns.findOne({
      where: {
        provider,
        sns_id: profile.id.toString(),
      },
      include: models.user, // user 정보 포함
    });

    let userInstance;
    await sequelize.transaction(async (t) => {
      if (!snsInstance) {
        // 신규 user 생성
        userInstance = await models.user.create(
          {
            name: profile.name || null,
            email: profile.email || null,
            phone: profile.phone || null,
          },
          { transaction: t }
        );
        // user_sns 연결 및 refresh token 발급
        snsInstance = await models.user_sns.create(
          {
            user_id: userInstance.id,
            provider,

            sns_id: profile.id.toString(),
            refresh_token: generateRefreshToken(),
          },
          { transaction: t }
        );
      } else {
        // 기존 사용자 로그인 -> refresh token 갱신
        userInstance = snsInstance.user;
        snsInstance.refresh_token = generateRefreshToken();
        await snsInstance.save({ transaction: t });
      }
    });

    // (4) JWT 발급
    const token = generateToken(userInstance);
    if (process.env.NODE_ENV === "development") {
      // 테스트
      // 현재 모바일 앱 deep link 대신 json으로 응답 -> 테스트용
      // JWT 만료시간 계산
      const decoded = jwt.decode(token);
      const expiresIn = decoded.exp - Math.floor(Date.now() / 1000); // 남은 시간(초)

      // 6) 클라이언트에 JSON 응답
      res.json({
        message: `${provider} login success`,
        jwt: token,
        expiresAt: decoded.exp, // 만료 timestamp
        expiresIn, // 남은 시간(초)
        refreshToken: snsInstance.refresh_token,
        user: {
          id: userInstance.id,
          name: userInstance.name,
          email: userInstance.email,
          phone: userInstance.phone,
        },
      });
    } else {
      // 배포용
      // (5) 모바일 앱으로 전달 (deep link)
      // yoyangi://login → 앱 실행, token + refreshToken 전달
      const deepLink = `yoyangi://callback?provider=${provider}&token=${encodeURIComponent(token)}&refreshToken=${encodeURIComponent(snsInstance.refresh_token)}&userId=${userInstance.id}`;
      res.redirect(deepLink);
    }
  } catch (err) {
    console.error(
      "[SNS Login Error]",
      err.response?.data || err.message || err
    );

    res.status(500).json({
      message: `${provider} login failed`,
    });
  }
}

// Refresh token으로 JWT 재발급
// Access Token 만료 시 클라이언트에서 호출
async function refreshToken(req, res) {
  const { refreshToken } = req.body;

  // refresh token 검증
  // 클라이언트가 보낸 refreshToken이 db에 존재하는지 확인
  const sns = await models.user_sns.findOne({
    where: { refresh_token: refreshToken },
    include: models.user,
  });
  // 없으면 401 반환
  if (!sns) {
    return res.status(401).json({
      message: "Invalid refresh token",
    });
  }
  // 존재하면 -> 해당 사용자 정보로 새 jwt 발급
  const token = generateToken(sns.user);
  res.json({
    message: "새로운 jwt token 발급",
    token,
  });
}

module.exports = {
  makeSnsAuthUrl,
  handleCallback,
  refreshToken,
  SNS_CONFIG,
};
