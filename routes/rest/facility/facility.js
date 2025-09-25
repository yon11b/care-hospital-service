const models = require('../../../models');
const sha256 = require('sha256');
const { literal, Op } = require('sequelize');
const app = require('../../../app');

async function getFacilities(req, res) {
  try {
    const page = parseInt(req.query.page) || 1; // 기본 1페이지
    const limit = parseInt(req.query.limit) || 20; // 기본 20개
    const offset = (page - 1) * limit;
    const latitude = parseFloat(req.query.latitude);
    const longitude = parseFloat(req.query.longitude);
    if (latitude && longitude) {
      const resp = await models.facility.findAll({
        where: {
          longitude: { [Op.ne]: '' },
          latitude: { [Op.ne]: '' },
        },
        attributes:
          latitude && longitude
            ? {
                include: [
                  [
                    literal(
                      `ST_DistanceSphere(
                  ST_MakePoint(longitude::double precision, latitude::double precision),
                  ST_MakePoint(${longitude}, ${latitude})
                )`,
                    ),
                    'distance',
                  ],
                ],
              }
            : undefined,
        order: literal('distance ASC'),
        limit,
        offset,
      });
      res.json({
        Message: 'Facility select successfully.',
        ResultCode: 'ERR_OK',
        Size: resp.length,
        Response: resp,
      });
      //res.send(resp);
    }
  } catch (err) {
    //bad request
    console.log(err);
    res.status(400).send({
      result: false,
      msg: err.toString(),
    });
  }
}

async function getFacility(req, res) {
  try {
    //pid: 받아온 id 파라미터
    const pid = req.params.id;
    const resp = await models.facility.findOne({
      where: {
        id: pid,
      },
      include: [],
      //include: [
      // {
      //   model: models.review,
      //   attributes: [],
      //   limit: 5, // 최근 5개만
      //   order: [['createdAt', 'DESC']], // 최신순
      // },
      //],
    });
    res.send(resp);
  } catch (err) {
    //bad request
    console.log(err);
    res.status(400).send({
      result: false,
      msg: err.toString(),
    });
  }
}
async function upsertFacility(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).send({
      Message: 'Method not allowed',
      ResultCode: 'ERR_INVALID_DATA',
    });
  }
  try {
    console.log('>>>>>>>>>>>>>>>>>>>>>>>>>>>');
    console.log(req.file);
    console.log('>>>>>>>>>>>>>>>>>>>>>>>>>>>');
    // req.body.userId = req.session.user.id;
    if (!req.session.user || req.session.user.facility_id != req.params.facilityid) {
      console.log(req.session.user);
      console.log(req.session.user.facility_id);
      console.log(req.params.facilityid);
      res.status(401).send({
        Message: 'Unauthorized',
        ResultCode: 'ERR_UNAUTHORIZED',
      });
    } else {
      await models.facility.update(
        {
          // PK는 반드시 포함해야 어떤 row를 upsert할지 알 수 있음
          ...req.body, // body에 담긴 변경값만 반영
          today_meal_url: req.file ? `https://${process.env.AWS_BUCKET}.s3.amazonaws.com/${req.file.key}` : undefined,
          // 파일이 있는 경우만 반영
        },
        {
          where: {
            id: req.params.facilityid,
          },
        },
      );
      console.log(req.file);
      const updatedFacility = await models.facility.findByPk(req.params.facilityid);
      res.send({
        Message: 'Success to facility information updated',
        ResultCode: 'ERR_OK',
        Response: {
          updatedFacility,
        },
      });
    }
  } catch (err) {
    // bad request
    console.log(err);
    res.status(400).send({
      result: false,
      msg: err.toString(),
    });
  }
}

// async function deleteApp(req, res) {
//   try {
//     await models.application.destroy({
//       where: {
//         id: req.params.id,
//       },
//     });

//     res.send({ result: true });
//   } catch (err) {
//     //bad request
//     console.log(err);
//     res.status(400).send({
//       result: false,
//       msg: err.toString(),
//     });
//   }
// }

module.exports = {
  getFacilities,
  getFacility,
  upsertFacility,
  //   deleteApp,
};
