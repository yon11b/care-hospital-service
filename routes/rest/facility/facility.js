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
  try {
    //req.body.userId = req.session.user.id;
    await models.facility.upsert({
      title: req.body.title,
      startTime: req.body.startTime,
      openTime: req.body.openTime,
      maxNum: req.body.maxNum,
      userId: req.body.userId,
      poster: req.file.filename,
    });
    console.log(req.file);
    res.send({ result: req.file });
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
