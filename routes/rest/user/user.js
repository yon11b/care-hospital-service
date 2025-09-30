const models = require("../../../models");
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
    res.status(404).send({
      result: false,
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
    const user = await models.staff.findOne({
      where: {
        email: req.body.email,
      },
    });

    if (!user) {
      if (req.body.role == "owner" && req.body.facility_number) {
        await models.staff.create({
          name: req.body.name,
          password: sha256(req.body.password),
          email: req.body.email,
          approval_status: "pending",
          role: req.body.role,
          facility_id: req.body.facility_id,
          facility_number: req.body.facility_number,
          //token: 'test',
        });
        await checkFacility(req.body.facility_number, req.body.email);
      } else if (req.body.role == "staff") {
        const token = await models.staff.findOne({
          where: {
            facility_token: req.body.facility_token,
          },
        });
        if (token) {
          await models.staff.create({
            name: req.body.name,
            password: sha256(req.body.password),
            email: req.body.email,
            approval_status: "approved",
            role: "staff",
            facility_id: req.body.facility_id,
          });
        }
      }
    } else {
      await models.staff.update(
        {
          name: req.body.name,
          password: sha256(req.body.password),
          email: req.body.email,
          role: req.body.role,
        },
        {
          where: {
            email: req.body.email,
          },
        }
      );

      //   req.session.user = await models.user.findOne({
      //     where: {
      //       uid: req.body.uid,
      //     },
      //     attributes: ['name', 'email'],
      //   });
    }

    res.send({
      result: true,
    });
  } catch (err) {
    //bad request
    console.log(err);
    res.status(400).send({
      result: false,
      msg: err.toString(),
    });
  }
}

async function login(req, res) {
  try {
    //const user = await models.staff.findAll();
    const userinfo = await models.staff.findOne({
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

    if (userinfo) {
      //res.json(user);
      req.session.user = userinfo;
      res.json("로그인, 세션 저장 성공");
    } else {
      res.json({
        result: false,
        message: "로그인에 실패하였습니다.",
      });
    }
  } catch (err) {
    console.log(err);
    res.json({
      result: false,
      msg: err.toString(),
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
};
