const models = require("../../models");
const session = require("express-session");
const sha256 = require("sha256");
const axios = require("axios");
const crypto = require("crypto");
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

async function checkFacility(bizNumber, email) {
  try {
    const serviceKey = process.env.OPEN_API;
    const url = `https://api.odcloud.kr/api/nts-businessman/v1/status?serviceKey=${serviceKey}&returnType=JSON`;
    const resp = await axios.post(
      url,
      { b_no: [bizNumber] },
      {
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    if (resp.data && resp.data.data && resp.data.data.length > 0) {
      const result = resp.data.data[0];
      if (result.b_stt === "계속사업자") {
        const token = generateAdminToken();
        await models.staff.update(
          { approval_status: "verified", facility_token: token },
          { where: { email } }
        );
        return { valid: true, info: result };
      } else {
        await models.staff.update(
          { approval_status: "rejected" },
          { where: { email } }
        );
        return { valid: false, info: result };
      }
    }
    return { valid: false, info: null };
  } catch (err) {
    console.error("사업자번호 조회 실패:", err.response?.data || err.message);
    return { valid: false, error: err.response?.data || err.message };
  }
}
// admin 승인 API
async function approveFacility(req, res) {
  try {
    // 관리자 권한 체크 (세션에서 role 확인)
    if (!req.session.user || req.session.user.role !== "admin") {
      return res.status(403).send({
        result: false,
        msg: "관리자 권한이 없습니다.",
      });
    }
    const email = req.body.email;
    // 먼저 verified 상태인지 확인
    const staff = await models.staff.findOne({
      where: { email: email },
    });
    if (!staff) {
      return res.status(404).send({
        result: false,
        msg: "해당 유저를 찾을 수 없습니다.",
      });
    }
    if (staff.approval_status !== "verified") {
      return res.status(400).send({
        result: false,
        msg: `승인할 수 없는 상태입니다. 현재 상태: ${staff.approval_status}`,
      });
    }
    // 승인 처리
    await models.staff.update(
      { approval_status: "approved" },
      { where: { email } }
    );
    res.send({
      result: true,
      msg: "승인 완료",
    });
  } catch (err) {
    console.error(err);
    res.status(500).send({
      result: false,
      msg: err.toString(),
    });
  }
}

async function upsertUser(req, res) {
  try {
    const {
      name,
      password,
      email,
      role,
      facility_id,
      facility_number,
      facility_token,
      approval_status,
    } = req.body;

    const currentUser = req.session.user;
    if (!currentUser) {
      return res
        .status(401)
        .json({ result: false, msg: "로그인이 필요합니다." });
    }

    // 기존 사용자 조회
    const existingUser = await models.staff.findOne({
      where: { id: currentUser.user.id },
    });

    if (!existingUser) {
      // 신규 사용자 처리
      if (role == "owner" && facility_number) {
        await models.staff.create({
          name,
          password: sha256(password),
          email,
          approval_status: "pending",
          role,
          facility_id,
          facility_number,
        });

        // 사업자번호 검증
        await checkFacility(facility_number, email);
      } else if (role == "staff") {
        // 직원 계정
        const tokenValid = await models.staff.findOne({
          where: { facility_token },
        });
        if (tokenValid) {
          await models.staff.create({
            name,
            password: sha256(password),
            email,
            approval_status: "approved",
            role,
            facility_id,
          });
        } else {
          return res
            .status(400)
            .json({ result: false, msg: "유효하지 않은 시설 토큰입니다." });
        }
      }
    } else {
      // 기존 사용자 업데이트
      const oldFacilityNumber = existingUser.facility_number;
      const updateData = {};
      if (name) updateData.name = name;
      if (password) updateData.password = sha256(password);
      if (email) updateData.email = email;
      if (role) updateData.role = role;
      if (facility_number) updateData.facility_number = facility_number;
      if (approval_status) updateData.approval_status = approval_status;

      await models.staff.update(updateData, { where: { id: userId } });

      // 시설 로그 기록
      if (facility_number && facility_number !== oldFacilityNumber) {
        await models.facility_log.create({
          facility_id: existingUser.facility_id,
          user_id: existingUser.id,
          action: "UPDATE",
          changed_data: {
            facility_number: {
              before: oldFacilityNumber,
              after: facility_number,
            },
          },
        });
      }
    }

    return res.status(200).json({ result: true });
  } catch (err) {
    console.error(err);
    return res.status(400).json({
      result: false,
      msg: err.toString(),
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
  login,
  logout,
  geolocation,
};
