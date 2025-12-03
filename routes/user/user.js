const sha256 = require("sha256");
const axios = require("axios");
const crypto = require("crypto");
const models = require("../../models");
require("dotenv").config();

function generateAdminToken(length = 32) {
  return crypto.randomBytes(length).toString("hex");
}

async function getSession(req, res) {
  if (req.session.user) {
    res.json({
      result: true,
      user: req.session.user,
    });
  } else {
    res.status(403).send({
      result: false,
    });
  }
}

async function geolocation(req, res) {
  const NCP_API_KEY_ID = process.env.NCP_API_KEY_ID;
  const NCP_API_KEY = process.env.NCP_API_KEY;

  try {
    const query = req.query.location;
    const url = "https://maps.apigw.ntruss.com/map-geocode/v2/geocode";

    const response = await axios.get(url, {
      params: { query },
      headers: {
        "x-ncp-apigw-api-key-id": NCP_API_KEY_ID,
        "x-ncp-apigw-api-key": NCP_API_KEY,
        Accept: "application/json",
      },
    });
    res.json({
      Message: "Geocode success",
      ResultCode: "ERR_OK",
      Response: response.data,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      Message: "Internal server error",
      ResultCode: "ERR_INTERNAL_SERVER",
      error,
    });
  }
}
// async function checkFacility(req, res) {
//   try {
//     const { bizNumber, ykiho } = req.body;
//     const user = req.session.user;

//     if (!user) {
//       return res
//         .status(401)
//         .json({ Status: false, msg: "로그인이 필요합니다." });
//     }

//     const id = user.id;
//     const serviceKey = process.env.OPEN_API;

//     // 1. 사업자번호 검증
//     let bizValid = false;
//     try {
//       const bizResp = await axios.post(
//         `https://api.odcloud.kr/api/nts-businessman/v1/status?serviceKey=${serviceKey}&returnType=JSON`,
//         { b_no: [bizNumber] },
//         { headers: { "Content-Type": "application/json" }, timeout: 3000 }
//       );

//       if (bizResp.data?.data?.length > 0) {
//         const result = bizResp.data.data[0];
//         if (result.b_stt === "계속사업자") bizValid = true;
//       }
//     } catch (err) {
//       console.error("사업자번호 조회 실패:", err.message);
//     }

//     // 2. 요양기호 검증
//     let ykihoValid = false;
//     if (ykiho) {
//       const ykihoUrl = `https://apis.data.go.kr/B551182/hospDiagInfoService1/getClinicTop5List1?serviceKey=${serviceKey}&numOfRows=1&pageNo=1&ykiho=${encodeURIComponent(ykiho)}`;
//       try {
//         const ykihoResp = await axios.get(ykihoUrl, { timeout: 3000 });
//         if (ykihoResp.status === 200) ykihoValid = true;
//       } catch (err) {
//         console.error("요양기호 조회 실패:", err.message);
//       }
//     }

//     // 3. staff 업데이트
//     let staff;
//     if (bizValid || ykihoValid) {
//       const token = generateAdminToken();
//       await models.staff.update(
//         { approval_status: "verified", facility_token: token },
//         { where: { id } }
//       );
//       staff = await models.staff.findOne({ where: { id } });
//       return res.status(200).json({
//         Status: true,
//         Message: "검증에 성공하였습니다.",
//         Result: staff,
//       });
//     } else {
//       await models.staff.update(
//         { approval_status: "rejected" },
//         { where: { id } }
//       );
//       staff = await models.staff.findOne({ where: { id } });
//       return res
//         .status(401)
//         .json({ Status: false, Result: "검증에 실패하였습니다." });
//     }
//   } catch (err) {
//     console.error("검증 과정 실패:", err.message);
//     return res.status(500).json({ Status: false, error: err.message });
//   }
// }

// admin 승인 API
// async function approveFacility(req, res) {
//   try {
//     // 관리자 권한 체크 (세션에서 role 확인)
//     if (!req.session.user || req.session.user.role !== "admin") {
//       return res.status(403).send({
//         result: false,
//         msg: "관리자 권한이 없습니다.",
//       });
//     }
//     const email = req.body.email;
//     // 먼저 verified 상태인지 확인
//     const staff = await models.staff.findOne({
//       where: { email: email },
//     });
//     if (!staff) {
//       return res.status(404).send({
//         result: false,
//         msg: "해당 유저를 찾을 수 없습니다.",
//       });
//     }
//     if (staff.approval_status !== "verified") {
//       return res.status(400).send({
//         result: false,
//         msg: `승인할 수 없는 상태입니다. 현재 상태: ${staff.approval_status}`,
//       });
//     }
//     // 승인 처리
//     await models.staff.update(
//       { approval_status: "approved" },
//       { where: { email } }
//     );
//     res.send({
//       result: true,
//       msg: "승인 완료",
//     });
//   } catch (err) {
//     console.error(err);
//     res.status(500).send({
//       result: false,
//       msg: err.toString(),
//     });
//   }
// }
async function checkStaff(req, res) {
  const { user_id, facility_id, facility_token } = req.body;

  try {
    if (!facility_id) {
      return res.status(401).json({
        Message: "이전 페이지에서 회원 정보를 입력해주세요",
        ResultCode: "ERR_UNAUTHORIZED",
      });
    }

    // 직원 토큰 검증
    const tokenValid = await models.staff.findOne({
      where: { facility_token },
    });

    if (!tokenValid) {
      return res.status(400).json({
        Message: "유효하지 않은 시설 토큰입니다.",
        ResultCode: "ERR_INVALID_TOKEN",
      });
    }

    // 이전에 입력하여 생성된 사용자 계정에 대해 facility_token 업데이트
    await models.staff.update(
      { approval_status: "approved" },
      { where: { id: user_id } }
    );

    return res.status(200).json({
      Message: "직원 검증이 완료되었습니다.",
      ResultCode: "OK",
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      Message: "서버 오류: " + err.message,
      ResultCode: "ERR_INTERNAL",
    });
  }
}

// -------------------- 신규 회원가입 --------------------
async function createUser(req, res) {
  try {
    const { name, password, email, role, facility_id, facility_number, ykiho } =
      req.body;

    // 0. 이메일 중복 체크
    const existingUser = await models.staff.findOne({
      where: { email },
    });

    if (existingUser) {
      return res.status(400).json({
        Message: "이미 존재하는 이메일입니다.",
        ResultCode: "ERR_EMAIL_EXISTS",
      });
    }

    let staff;
    if (role == "owner") {
      // 1. 사업자번호 / 요양기호 검증
      let validFacility = false;
      const serviceKey = process.env.OPEN_API;

      // 1-1. 사업자번호 검증
      if (facility_number) {
        try {
          const bizResp = await axios.post(
            `https://api.odcloud.kr/api/nts-businessman/v1/status?serviceKey=${serviceKey}&returnType=JSON`,
            { b_no: [facility_number] },
            { headers: { "Content-Type": "application/json" }, timeout: 3000 }
          );
          if (bizResp.data?.data?.length > 0) {
            const result = bizResp.data.data[0];
            if (result.b_stt === "계속사업자") validFacility = true;
          }
        } catch (err) {
          console.error("사업자번호 조회 실패:", err.message);
        }
      }

      // 1-2. 요양기호 검증
      if (!validFacility && ykiho) {
        try {
          const ykihoUrl = `https://apis.data.go.kr/B551182/hospDiagInfoService1/getClinicTop5List1?serviceKey=${serviceKey}&numOfRows=1&pageNo=1&ykiho=${encodeURIComponent(
            ykiho
          )}`;
          const ykihoResp = await axios.get(ykihoUrl, { timeout: 3000 });
          if (ykihoResp.status === 200) validFacility = true;
        } catch (err) {
          console.error("요양기호 조회 실패:", err.message);
        }
      }

      if (!validFacility) {
        return res.status(400).json({
          Message: "유효하지 않은 사업자번호 또는 요양기호입니다.",
          ResultCode: "ERR_INVALID_FACILITY",
        });
      }
      // 2. 신규 사용자 생성
      staff = await models.staff.create({
        name,
        password: sha256(password),
        email,
        role,
        approval_status: "verified",
        facility_id,
        facility_number: facility_number || null,
        ykiho: ykiho || null,
        facility_token: generateAdminToken(),
      });
    }
    // 일반 직원의 신규 회원가입
    else {
      staff = await models.staff.create({
        name,
        password: sha256(password),
        email,
        role,
        approval_status: "pending",
        facility_id,
      });
    }
    return res.status(200).json({
      Message: "회원가입이 완료되었습니다.",
      ResultCode: "OK",
      Result: staff,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      Message: "서버 오류: " + err.message,
      ResultCode: "ERR_INTERNAL",
    });
  }
}

// -------------------- 기존 회원 업데이트 --------------------
async function updateUser(req, res) {
  try {
    const { name, password, email, role, approval_status } = req.body;

    const currentUser = req.session.user;
    if (!currentUser) {
      return res.status(401).json({
        Message: "Unauthorized - 로그인 필요",
        ResultCode: "ERR_UNAUTHORIZED",
      });
    }

    // 기존 사용자 조회
    const existingUser = await models.staff.findOne({
      where: { id: currentUser.id },
    });

    if (!existingUser) {
      return res.status(404).json({
        Message: "해당 사용자를 찾을 수 없습니다.",
        ResultCode: "ERR_USER_NOT_FOUND",
      });
    }

    // 허용된 업데이트 필드만 선택
    const allowedFields = [
      "name",
      "password",
      "email",
      "role",
      "approval_status",
    ];
    const updateData = {};

    // password는 sha256 적용
    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        updateData[field] =
          field === "password" ? sha256(req.body[field]) : req.body[field];
      }
    });

    await models.staff.update(updateData, { where: { id: currentUser.id } });

    return res.status(200).json({
      Message: "회원 정보가 업데이트되었습니다.",
      ResultCode: "OK",
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      Message: "서버 오류: " + err.message,
      ResultCode: "ERR_INTERNAL",
    });
  }
}

async function login(req, res) {
  try {
    //const user = await models.staff.findAll();
    const user = await models.staff.findOne({
      where: {
        email: req.body.email,
        password: String(sha256(req.body.password)),
      },
      attributes: [
        "id",
        "name",
        "email",
        "facility_id",
        "approval_status",
        "role",
        "facility_token",
      ],
    });

    if (user) {
      await models.login_log.create({
        user_id: user.id,
        user_type: "staff",
        ip_address: req.ip,
        user_agent: req.headers["user-agent"],
        login_result: true,
      });
      req.session.user = user;
      return res.status(200).send({
        result: true,
        Message: "staff login and session save successfully",
        ResultCode: "ERR_OK",
        Response: user,
      });
    } else {
      const isEmail = await models.staff.findOne({
        where: {
          email: req.body.email,
        },
      });
      if (isEmail) {
        await models.login_log.create({
          user_id: isEmail.id,
          user_type: "staff",
          ip_address: req.ip,
          user_agent: req.headers["user-agent"],
          login_result: false,
        });
      }
      return res.status(401).send({
        result: false,
        Message: "Invalid email or password.",
        ResultCode: "ERR_INVALID_CREDENTIALS",
      });
    }
  } catch (err) {
    console.log(err);
    return res.status(500).send({
      result: false,
      Message: error.message || "Internal server error",
      ResultCode: "ERR_INTERNAL_SERVER",
      error,
    });
  }
}

//Checks if the ID already exists
// async function checkID(req, res) {
//   try {
//     const user = await models.user.findOne({
//       where: {
//         uid: req.body.uid,
//       },
//     });

//     if (user) {
//       //found
//       res.send({
//         result: true,
//       });
//     } else {
//       //not found
//       res.send({
//         result: false,
//       });
//     }
//   } catch (err) {
//     //bad request
//     res.status(400).send({
//       result: false,
//       msg: err.toString(),
//     });
//   }
// }

async function logout(req, res) {
  try {
    if (req.session.user) {
      req.session.destroy((err) => {});
    }
    res.status(200).send({
      result: true,
    });
  } catch (err) {
    res.status(200).send({
      result: false,
      msg: err.toString(),
    });
  }
}

// 1. refreshtoken 을 이용해ㅓ 유저의 정보 모두 주는 함수.. 만들기
// async function getRefreshTokenDetail(req, res){}

// 2. jwt를 이용하여 유저의 정보를 모두 주는 함수 만들기
// authMiddleware에서 받아온 payload 사용
// 토큰이 없으면 404 authMiddleware - Token missing 발생
// GET api/user/jwt/detail
async function getJwtDetails(req, res) {
  try {
    const payload = req.user; // { id, email }

    if (!payload || !payload.id) {
      return res
        .status(401)
        .json({ result: false, msg: "Invalid token payload" });
    }

    // DB에서 사용자 정보 조회
    const user = await models.user.findByPk(payload.id, {
      attributes: [
        "id",
        "name",
        "email",
        "phone",
        "created_at",
        "status",
        "facilityLikes",
        "updated_at",
        "currentLocation",
      ], // 필요한 필드
    });

    if (!user) {
      return res.status(404).json({ result: false, msg: "User not found" });
    }

    // 필요하면 SNS 정보도 같이 조회 가능
    const snsAccounts = await models.user_sns.findAll({
      where: { user_id: user.id },
      attributes: ["provider", "sns_id", "refresh_token"],
    });

    res.json({
      result: true,
      msg: "User details fetched successfully",
      user: {
        ...user.toJSON(),
        snsAccounts,
      },
    });
  } catch (err) {
    res.status(500).json({ result: false, msg: err.toString() });
  }
}

module.exports = {
  getSession,
  createUser,
  updateUser,
  // approveFacility,
  // checkFacility,
  login,
  logout,
  geolocation,
  checkStaff,
  getJwtDetails,
};
