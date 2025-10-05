const models = require("../../models");
const sha256 = require("sha256");
const { literal, Op } = require("sequelize");
const app = require("../../app");

async function getFacilities(req, res) {
  try {
    const page = parseInt(req.query.page) || 1; // 기본 1페이지
    const limit = parseInt(req.query.limit) || 20; // 기본 20개
    const offset = (page - 1) * limit;
    const latitude = parseFloat(req.query.latitude);
    const longitude = parseFloat(req.query.longitude);
    const keyword = req.query.keyword;

    //if (latitude && longitude) {
    const resp = await models.facility.findAll({
      where: {
        longitude: { [Op.ne]: "" },
        latitude: { [Op.ne]: "" },
        ...(keyword && { name: { [Op.iLike]: `%${keyword}%` } }),
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
                )`
                  ),
                  "distance",
                ],
              ],
            }
          : undefined,
      include: [
        { model: models.facility_status },
        { model: models.advertisement },
      ],
      order: latitude && longitude ? literal("distance ASC") : [["id", "ASC"]],
      limit,
      offset,
    });
    res.json({
      Message: "Facility select successfully.",
      ResultCode: "ERR_OK",
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
    const resp = await models.facility.findOne({
      where: {
        id: pid,
      },
      include: [
        { model: models.facility_status },
        { model: models.advertisement },
      ],
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
async function upsertNotice(req, res) {
  try {
    // 메소드 검사
    if (req.method !== "POST") {
      return res.status(405).send({
        Message: "Method not allowed",
        ResultCode: "ERR_INVALID_DATA",
      });
    }

    // 세션 검사
    if (!req.session || !req.session.user) {
      return res.status(401).send({
        Message: "Forbidden - 로그인이 필요합니다.",
        ResultCode: "ERR_UNAUTHORIZED",
      });
    }

    if (req.session.user.facility_id != req.params.facilityid) {
      return res.status(403).send({
        Message: "Forbidden - 접근 권한이 없습니다.",
        ResultCode: "ERR_FORBIDDEN",
      });
    }

    let updatedNotice;

    if (req.body.notyid) {
      // UPDATE
      const [affectedCount, rows] = await models.notice.update(
        {
          facility_id: req.params.facilityid,
          ...req.body,
          picture: req.file
            ? `https://${process.env.AWS_BUCKET}.s3.amazonaws.com/${req.file.key}`
            : undefined,
        },
        {
          where: { id: req.body.notyid },
          returning: true, // Postgres에서만 지원
        }
      );

      if (affectedCount === 0) {
        return res.status(404).send({
          Message: "notice not found",
          ResultCode: "ERR_NOT_FOUND",
        });
      }
      updatedNotice = rows[0];
    } else {
      updatedNotice = await models.notice.create({
        facility_id: req.params.facilityid,
        ...req.body,
        picture: req.file
          ? `https://${process.env.AWS_BUCKET}.s3.amazonaws.com/${req.file.key}`
          : undefined,
      });
    }
    return res.status(200).send({
      Message: "notice upsert successfully",
      ResultCode: "ERR_OK",
      Response: updatedNotice,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).send({
      Message: error.message || "Internal server error",
      ResultCode: "ERR_INTERNAL_SERVER",
      error,
    });
  }
}

async function getMeals(req, res) {
  try {
    const meals = await models.meal.findOne({
      where: {
        facility_id: req.params.facilityid,
      },
    });
    return res.status(200).send({
      Message: "meals select successfully",
      ResultCode: "ERR_OK",
      Response: meals,
    });
  } catch (err) {
    // bad request
    console.log(err);
    res.status(400).send({
      result: false,
      msg: err.toString(),
    });
  }
}

async function upsertMeal(req, res) {
  if (req.method !== "POST") {
    return res.status(405).send({
      Message: "Method not allowed",
      ResultCode: "ERR_INVALID_DATA",
    });
  }
  try {
    if (
      !req.session.user ||
      req.session.user.role == "user" ||
      req.session.user.facility_id != req.params.facilityid
    ) {
      res.status(401).send({
        Message: "Unauthorized",
        ResultCode: "ERR_UNAUTHORIZED",
      });
    } else {
      const updatedMeal = await models.meal.upsert({
        facility_id: req.params.facilityid,
        today_meal_desc: req.body.today_meal_desc,
        meal_date: req.body.meal_date,
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
      res.send({
        Message: "Success to meal information updated",
        ResultCode: "ERR_OK",
        Response: {
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

async function upsertFacility(req, res) {
  if (req.method !== "POST") {
    return res.status(405).send({
      Message: "Method not allowed",
      ResultCode: "ERR_INVALID_DATA",
    });
  }
  try {
    if (
      !req.session.user ||
      req.session.user.role == "user" ||
      req.session.user.facility_id != req.params.facilityid
    ) {
      res.status(401).send({
        Message: "Unauthorized",
        ResultCode: "ERR_UNAUTHORIZED",
      });
    } else {
      const updatedFacility = await models.facility.update(
        {
          ...req.body,
        },
        {
          where: {
            id: req.params.facilityid,
          },
        }
      );

      console.log(req.file);

      res.send({
        Message: "Success to facility information updated",
        ResultCode: "ERR_OK",
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
async function deleteNotice(req, res) {
  try {
    await models.notice.destroy({
      where: {
        id: req.params.notyid,
      },
    });

    res.send({ result: true });
  } catch (err) {
    //bad request
    console.log(err);
    res.status(400).send({
      result: false,
      msg: err.toString(),
    });
  }
}

async function getNotice(req, res) {
  try {
    //pid: 받아온 id 파라미터
    const notyid = req.params.notyid;
    const resp = await models.notice.findOne({
      where: {
        id: notyid,
      },
    });

    if (!resp) {
      return res.status(404).json({
        Message: "notice not found",
        ResultCode: "ERR_NOT_FOUND",
        status: "404",
      });
    }

    res.json({
      Message: "notice select successfully.",
      ResultCode: "ERR_OK",
      Response: resp,
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
async function getNotices(req, res) {
  try {
    const page = parseInt(req.query.page) || 1; // 기본 1페이지
    const limit = parseInt(req.query.limit) || 20; // 기본 20개
    const offset = (page - 1) * limit;
    const { keyword } = req.query;

    const resp = await models.notice.findAll({
      where: keyword
        ? {
            [Op.or]: [
              { title: { [Op.iLike]: `%${keyword}%` } },
              { content: { [Op.iLike]: `%${keyword}%` } },
            ],
          }
        : {},
      order: [["created_at", "DESC"]],
      limit,
      offset,
    });
    res.json({
      Message: "Notifications select successfully.",
      ResultCode: "ERR_OK",
      Size: resp.length,
      Response: resp,
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

module.exports = {
  getFacilities,
  getFacility,
  upsertMeal,
  upsertFacility,
  upsertNotice,
  deleteNotice,
  getNotices,
  getNotice,
  getMeals,
};
