const models = require("../../models");
const sha256 = require("sha256");
const { literal, Op } = require("sequelize");
const app = require("../../app");

async function getFacilities(req, res) {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    const latitude = req.query.latitude
      ? parseFloat(req.query.latitude)
      : 37.5664;
    const longitude = req.query.longitude
      ? parseFloat(req.query.longitude)
      : 126.9779;
    const keyword = req.query.keyword || "";
    const kind = req.query.kind
      ? req.query.kind.split(",").map((k) => k.trim())
      : [];

    // 전체 개수 조회
    const totalCount = await models.facility.count({
      where: {
        ...(keyword && { name: { [Op.iLike]: `%${keyword}%` } }),
        ...(longitude && { longitude: { [Op.ne]: null } }),
        ...(latitude && { latitude: { [Op.ne]: null } }),
        ...(kind.length > 0 && { kind: { [Op.in]: kind } }),
      },
      distinct: true,
    });

    // 데이터 조회
    const resp = await models.facility.findAll({
      where: {
        ...(keyword && { name: { [Op.iLike]: `%${keyword}%` } }),

        ...(longitude && { longitude: { [Op.ne]: null } }),
        ...(latitude && { latitude: { [Op.ne]: null } }),
        ...(kind.length > 0 && { kind: { [Op.in]: kind } }),
      },
      attributes: {
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
      },
      include: [
        { model: models.facility_status },
        { model: models.advertisement },
      ],
      order: [[literal("distance"), "ASC"]],
      limit,
      offset,
      distinct: true,
    });

    const isLastPage = offset + resp.length >= totalCount;
    const totalPage = Math.ceil(totalCount / resp.length);

    res.json({
      Message: "Facility select successfully.",
      ResultCode: "ERR_OK",
      Size: resp.length,
      TotalCount: totalCount,
      TotalPage: totalPage,
      Page: page,
      IsLastPage: isLastPage,
      Response: resp,
    });
  } catch (err) {
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
    });
    if (!resp) {
      return res.status(404).json({
        Message: "Facility not found",
        ResultCode: "ERR_NOT_FOUND",
        status: "404",
      });
    }
    res.json({
      Message: "Facility select successfully.",
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

    // 추가 -> 이미지 삭제 기능
    // 이미지 처리: 삭제 체크 / 새 파일 / 기존 유지
    let picture;
    if (req.file) {
      // 새 파일이 있으면 무조건 새 파일 URL
      picture = req.file.location; 
    } else if (req.body.removeImage === 'true') {
      // 새 파일 없고 삭제 체크 되어 있으면 null
      picture = null;
    } else {
      // 아무 것도 안 하면 기존 이미지 유지
      picture = undefined;
    }
 
    console.log(req.file)

    const noticeId = req.body.notyid ? parseInt(req.body.notyid, 10) : undefined;
    const { notyid, removeImage, ...rest } = req.body;

    if (noticeId) {
      // UPDATE
      const [affectedCount, rows] = await models.notice.update(
        {
          ...rest,
          picture,
        },
        {
          where: { id: noticeId },
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
      // CREATE
      updatedNotice = await models.notice.create({
        facility_id: req.params.facilityid,
        ...rest,
        picture,
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

// 기관 대시보드 공지사항 전체 조회 
// -> 추가 수정 사항 : 특정 기관의 공지사항 조회로 변경
// -> session의 facility_id 조건에 추가
async function getNotices(req, res) {
  try {
    const page = parseInt(req.query.page) || 1; // 기본 1페이지
    const limit = parseInt(req.query.limit) || 20; // 기본 20개
    const offset = (page - 1) * limit;
    const { keyword } = req.query;

    // 해당 기관의 유저만...
    if (
      !req.session.user ||
      req.session.user.facility_id != req.params.facilityid
    ) {
      return res.status(401).send({
        Message: "Unauthorized",
        ResultCode: "ERR_UNAUTHORIZED",
      });
    } 

    // 조건 필터
    const whereCondition = {
      facility_id: req.session.user.facility_id, 
      ...(keyword && {
        [Op.or]: [
          { title: { [Op.iLike]: `%${keyword}%` } },
          { content: { [Op.iLike]: `%${keyword}%` } },
        ],
      }),
    };

    const resp = await models.notice.findAll({
      where: whereCondition,
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
