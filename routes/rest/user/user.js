const models = require('../../../models');
const sha256 = require('sha256');
const axios = require('axios');
const dotenv = require('dotenv').config();
const crypto = require('crypto');

function generateAdminToken(length = 32) {
  return crypto.randomBytes(length).toString('hex');
}

async function getSession(req, res) {
  if (req.session.user) {
    res.send({
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
          'Content-Type': 'application/json',
        },
      },
    );

    if (resp.data && resp.data.data && resp.data.data.length > 0) {
      const result = resp.data.data[0];
      if (result.b_stt === '계속사업자') {
        const token = generateAdminToken();
        console.log('>>>>>>>>>>>>>>>>');
        console.log(token);
        console.log('>>>>>>>>>>>>>>>>');
        await models.staff.update({ status: 'approved', facility_token: token }, { where: { email } });
        return { valid: true, info: result };
      } else {
        await models.staff.update({ status: 'rejected' }, { where: { email } });
        return { valid: false, info: result };
      }
    }
    return { valid: false, info: null };
  } catch (err) {
    console.error('사업자번호 조회 실패:', err.response?.data || err.message);
    return { valid: false, error: err.response?.data || err.message };
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
      if (req.body.role == 'owner' && req.body.facility_number) {
        await models.staff.create({
          name: req.body.name,
          password: sha256(req.body.password),
          email: req.body.email,
          status: 'pending',
          role: req.body.role,
          facility_id: req.body.facility_id,
          facility_number: req.body.facility_number,
          //token: 'test',
        });
        checkFacility(req.body.facility_number, req.body.email);
      } else if (req.body.role == 'staff') {
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
            status: 'approved',
            role: 'staff',
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
        },
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
    const user = await models.staff.findOne({
      where: {
        email: req.body.email,
        password: sha256(req.body.password),
      },
      attributes: ['id', 'name', 'email', 'status', 'role'],
    });

    if (user) {
      req.session.user = user;
      res.send({
        result: true,
        session: user,
      });
    } else {
      res.send({
        result: false,
        message: '로그인에 실패하였습니다.',
      });
    }
  } catch (err) {
    console.log(err);
    res.status(400).send({
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
      req.session.destroy(err => {});
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
  login,
  //checkID,
  logout,
};
