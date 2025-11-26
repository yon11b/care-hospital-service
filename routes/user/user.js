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
  const { facility_token } = req.body;

  try {
    if (!req.session.user) {
      return res.status(401).json({
        Message: "Unauthorized - 로그인 필요",
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

    // 로그인된 사용자에 대해 facility_token 업데이트
    const staff = await models.staff.update(
      { facility_token, approval_status: "approved" },
      { where: { id: req.session.user.id } }
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
async function upsertUser(req, res) {
  try {
    const { name, password, email, role, facility_id, facility_number, ykiho } =
      req.body;

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

    // 1. 사업자번호/요양기호 검증 (둘 중 하나라도 유효해야 가입)
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

    // 2. 신규 사용자 처리
    if (!existingUser) {
      await models.staff.create({
        name,
        password: sha256(password),
        email,
        approval_status: "pending",
        role,
        facility_id,
        facility_number: facility_number || null,
        ykiho: ykiho || null,
      });

      return res.status(200).json({
        Message: "회원가입이 완료되었습니다.",
        ResultCode: "OK",
      });
    } else {
      // 기존 사용자 업데이트
      const updateData = {};
      if (name) updateData.name = name;
      if (password) updateData.password = sha256(password);
      if (email) updateData.email = email;
      if (role) updateData.role = role;

      await models.staff.update(updateData, { where: { id: currentUser.id } });

      return res.status(200).json({
        Message: "회원 정보가 업데이트되었습니다.",
        ResultCode: "OK",
      });
    }
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

module.exports = {
  getSession,
  upsertUser,
  approveFacility,
  checkFacility,
  login,
  logout,
  geolocation,
  checkStaff,
};
