const models = require("../../models"); // Sequelize models
const { SolapiMessageService } = require("solapi");
const { Op } = require("sequelize");
const sequelize = require("../../models").sequelize;
const {
  generateToken,
  generateRefreshToken,
} = require("../../middleware/auth");

const messageService = new SolapiMessageService(
  process.env.SOLAPI_API_KEY,
  process.env.SOLAPI_API_SECRET
);

// 인증번호 생성
function generateCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// 하이픈 없는 번호를 010-1234-5678 형태로
function formatPhoneNumber(phone) {
  if (!/^01[0-9]{8,9}$/.test(phone)) return phone;

  return phone.length === 10
    ? phone.replace(/(\d{3})(\d{3})(\d{4})/, "$1-$2-$3")
    : phone.replace(/(\d{3})(\d{4})(\d{4})/, "$1-$2-$3");
}

// 이름 짓기
function generateGuardianName() {
  const randomNum = Math.floor(100000 + Math.random() * 900000); // 100000~999999
  return `보호자${randomNum}`;
}

// ===========================================
// 1. 인증번호 발송
// ===========================================
async function sendMessage(req, res) {
  try {
    const { phone } = req.body;

    if (!phone)
      return res.status(400).json({
        Message: "전화번호를 입력해주세요",
        ResultCode: "ERR_NOT_PHONE_NUMBER",
      });

    if (!/^01[0-9]{8,9}$/.test(phone))
      return res.status(400).json({
        Message: "전화번호 형식이 올바르지 않습니다.",
        ResultCode: "ERR_INVALID_PHONE_FORMAT",
      });

    const formattedPhone = formatPhoneNumber(phone);
    const code = generateCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10분 TTL
    console.log(new Date().toString());

    if (process.env.NODE_ENV === "development") {
      // 운영환경 : 실제 문자 발송
      const responses = await messageService.send({
        to: phone,
        from: process.env.SOLAPI_TEST_FROM,
        text: `[Yoyang2] 본인확인을 위해 인증번호[${code}]를 입력해주세요.`,
      });

      const result = Array.isArray(responses) ? responses[0] : responses;
      if (result.failedMessageList && result.failedMessageList.length > 0) {
        return res.status(502).json({
          Message: "문자 발송 서비스 오류",
          ResultCode: "ERR_SMS_SERVICE",
        });
      }
    }

    // db에 인증번호 저장 (만료시간 10분)
    await models.user_auth_codes.upsert({
      phone: formattedPhone,
      code,
      expires_at: expiresAt,
    });

    res.json({
      Message: "문자 발송 완료",
      ResultCode: "SUCCESS",
      code,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      Message: "문자 발송 실패",
      ResultCode: "ERR_SMS_SEND_FAILED",
      error: err.message || err.toString(),
    });
  }
}

// ====================================
// 2. 인증번호 검증 및 로그인
// ====================================
async function verifyAndLogin(req, res) {
  try {
    const { phone, code } = req.body;

    if (!phone)
      return res.status(400).json({
        Message: "전화번호를 입력해주세요.",
        ResultCode: "ERR_MISSING_PHONE_NUMBER",
      });

    if (!code)
      return res.status(400).json({
        Message: "인증번호를 입력해주세요.",
        ResultCode: "ERR_MISSING_CODE",
      });

    const formattedPhone = formatPhoneNumber(phone);

    // 1️⃣ 입력한 phone+code 조회 (유효기간 조건 제거)
    const authRecord = await models.user_auth_codes.findOne({
      where: {
        phone: formattedPhone,
        code,
      },
    });

    if (!authRecord) {
      // 2️⃣ 입력한 phone 자체가 DB에 있는지 확인
      const phoneExists = await models.user_auth_codes.findOne({
        where: { phone: formattedPhone },
      });

      if (!phoneExists) {
        return res.status(400).json({
          Message: "인증번호를 먼저 요청해주세요.",
          ResultCode: "ERR_CODE_NOT_REQUESTED",
        });
      }

      // phone은 존재하지만 code가 다름 → 틀린 코드
      return res.status(400).json({
        Message: "인증번호가 틀렸습니다.",
        ResultCode: "ERR_CODE_INVALID",
      });
    }

    // 3️⃣ 코드가 존재하면 유효기간 체크
    if (authRecord.expires_at <= new Date()) {
      return res.status(400).json({
        Message: "인증번호가 만료되었습니다.",
        ResultCode: "ERR_CODE_EXPIRED",
      });
    }

    // 인증 성공 시 -> 회원가입 or 로그인
    // 1. user_sns에서 phone 로그인용 계정 확인
    let sns = await models.user_sns.findOne({
      where: { provider: "phone", sns_id: formattedPhone },
      include: models.user,
    });

    let user;
    if (sns) {
      // 기존에 phone 로그인용 계정이 있으면 해당 유저 연결
      user = sns.user;
    } else {
      // 없으면 새 user 생성
      user = await models.user.create({ phone: formattedPhone });
      sns = await models.user_sns.create({
        user_id: user.id,
        provider: "phone",
        sns_id: formattedPhone,
        refresh_token: generateRefreshToken(),
      });
    }

    // JWT
    const accessToken = generateToken(user);

    // 사용 후 인증번호 삭제
    await authRecord.destroy();

    if (!user.name) {
      user.name = generateGuardianName();
      await user.save(); // 이후 로그인/채팅 등에서 일관성 유지
    }

    res.json({
      Message: "전화번호 인증 로그인 성공",
      ResultCode: "SUCCESS",
      user: {
        id: user.id,
        name: user.name,
        phone: user.phone,
      },
      token: accessToken, // 액세스 토큰
      refreshToken: sns.refresh_token, // refresh_token
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      Message: "인증 처리 중 오류 발생",
      ResultCode: "ERR_VERIFY_FAILED",
      error: err.message || err.toString(),
    });
  }
}

module.exports = { sendMessage, verifyAndLogin };
