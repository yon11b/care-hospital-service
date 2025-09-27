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
    const name = req.query.name;

    //if (latitude && longitude) {
    const resp = await models.facilities.findAll({
      where: {
        longitude: { [Op.ne]: '' },
        latitude: { [Op.ne]: '' },
        ...(name && { name: { [Op.iLike]: `%${name}%` } }),
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
      order: latitude && longitude ? literal('distance ASC') : [['id', 'ASC']],
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
    //}
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
    const resp = await models.facilities.findOne({
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
    if (!req.session.user || req.session.user.role == 'user' || req.session.user.facility_id != req.params.facilityid) {
      res.status(401).send({
        Message: 'Unauthorized',
        ResultCode: 'ERR_UNAUTHORIZED',
      });
    } else {
      await models.facilities.update(
        {
          ...req.body,
        },
        {
          where: {
            id: req.params.facilityid,
          },
        },
      );

      await models.meal.upsert({
        facility_id: req.params.facilityid,
        today_meal_desc: req.body.today_meal_desc,
        breakfast_meal_picture_url: req.files.breakfast_meal_picture_url
          ? `https://${process.env.AWS_BUCKET}.s3.amazonaws.com/${req.files.breakfast_meal_picture_url[0].key}`
          : undefined,
        lunch_meal_picture_url: req.files.lunch_meal_picture_url
          ? `https://${process.env.AWS_BUCKET}.s3.amazonaws.com/${req.files.lunch_meal_picture_url[0].key}`
          : undefined,
        dinner_meal_picture_url: req.files.dinner_meal_picture_url
          ? `https://${process.env.AWS_BUCKET}.s3.amazonaws.com/${req.files.dinner_meal_picture_url[0].key}`
          : undefined,
        week_meal_picture_url: req.files.week_meal_picture_url
          ? `https://${process.env.AWS_BUCKET}.s3.amazonaws.com/${req.files.week_meal_picture_url[0].key}`
          : undefined,
      });

      console.log(req.file);
      const updatedFacility = await models.facilities.findByPk(req.params.facilityid);
      const updatedMeal = await models.meal.findOne({
        where: {
          facility_id: req.params.facilityid,
        },
      });
      res.send({
        Message: 'Success to facility information updated',
        ResultCode: 'ERR_OK',
        Response: {
          updatedFacility,
          updatedMeal,
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
