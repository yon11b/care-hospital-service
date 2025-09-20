const models = require('../../../models');
const sha256 = require('sha256');
const app = require('../../../app');

async function getFacilities(req, res) {
  try {
    const resp = await models.facility.findAll({
      // attributes: {
      //   include: [[models.Sequelize.fn('COUNT', models.Sequelize.col('reviews.id')), 'reviewsCount']],
      // },
      //group: ['facility.id'],
      //include: [],
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
