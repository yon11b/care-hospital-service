const models = require("../../models");
const { Op } = require("sequelize");
const Sequelize = require("sequelize");

// GET /admin/statistics/reviews
async function getReviews(req, res) {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const offset = (page - 1) * limit;
    const sort = req.query.sort || "latest"; // latest(default) 또는 rating

    // 1. 파라미터 유효성 체크
    if (isNaN(limit) || limit <= 0) {
      return res.status(400).json({
        Message: "Invalid limit parameter",
        ResultCode: "ERR_INVALID_PARAMETER",
      });
    }
    if (!["latest", "rating"].includes(sort)) {
      return res.status(400).json({
        Message: "Invalid sort parameter",
        ResultCode: "ERR_INVALID_PARAMETER",
      });
    }

    // 4. 정렬 기준
    const order =
      sort === "latest"
        ? [["created_at", "DESC"]]
        : [
            ["rating", "DESC"],
            ["created_at", "DESC"],
          ];

    // 5. 리뷰 조회
    const reviews = await models.review.findAll({
      order,
      limit,
      offset,
      attributes: [
        "id",
        "user_id",
        "content",
        "images",
        "rating",
        "status",
        "visited",
        "created_at",
        [
          Sequelize.literal(`(
        SELECT COUNT(*)
        FROM reports AS report
        WHERE report.target_id = review.id
          AND report.type = 'REVIEW'
      )`),
          "report_count",
        ],
      ],
      include: [
        { model: models.user, attributes: ["id", "name"] },
        { model: models.facility, attributes: ["id", "name"] },
      ],
    });

    // 6. 다음 페이지 여부 체크
    const totalReviews = await models.review.count();
    const hasNextPage = offset + reviews.length < totalReviews;

    // 7. 응답
    res.status(200).json({
      Message: "Success",
      ResultCode: "OK",
      page,
      limit,
      totalReviews,
      hasNextPage,
      data: reviews.map((r) => r.get({ plain: true })),
    });
  } catch (err) {
    console.error(err);
    res.status(400).json({
      Message: "Invalid parameter - 잘못된 쿼리",
      ResultCode: "ERR_INVALID_PARAMETER",
      Error: err.toString(),
    });
  }
}

async function getReview(req, res) {
  try {
    // 경로 파라미터에서 id 가져오기
    const reviewId = parseInt(req.params.id, 10);

    // 리뷰 조회 (작성자 정보 포함)
    const review = await models.review.findOne({
      where: {
        id: reviewId,
      },
      attributes: [
        "id",
        "user_id",
        "content",
        "images",
        "rating",
        "status",
        "visited",
        "created_at",
        "updated_at",
        [
          Sequelize.literal(`(
        SELECT COUNT(*)
        FROM reports AS report
        WHERE report.target_id = review.id
          AND report.type = 'REVIEW'
      )`),
          "report_count",
        ],
      ],
      include: [
        {
          model: models.user,
          attributes: ["id", "name"], // 작성자 정보
        },
        { model: models.facility, attributes: ["id", "name"] },
        { model: models.reservation, attributes: ["id"] },
      ],
    });

    if (!review) {
      return res.status(404).json({
        Message: "리뷰가 존재하지 않습니다.",
        ResultCode: "ERR_NOT_FOUND",
      });
    }

    // 응답(Response) 보내기
    res.status(200).json({
      Message: "Success",
      ResultCode: "OK",
      data: review.get({ plain: true }),
    });
  } catch (err) {
    //bad request
    console.error("getReview error:", err);
    res.status(500).json({
      Message: "서버 에러",
      ResultCode: "ERR_SERVER",
      Error: err.toString(),
    });
  }
}

async function updateReview(req, res) {
  try {
    // 경로 파라미터에서 id 가져오기
    const id = parseInt(req.params.id, 10);
    const { status } = req.body;
    const review = await models.review.findOne({
      where: {
        id,
      },
    });
    await review.update(
      { status }, // 업데이트할 컬럼과 값
      {
        where: { id }, // 조건
      }
    );
    await review.reload();
    //   },
    //   attributes: {
    //     include: [
    //       sequelize.literal(`(
    //     SELECT COUNT(*)
    //     FROM reports AS report
    //     WHERE report.target_id = review.id
    //       AND report.type = 'REVIEW'
    //   )`),
    //       "report_count",
    //     ],
    //   },
    //   include: [
    //     {
    //       model: models.user,
    //       attributes: ["id", "name"], // 작성자 정보
    //     },
    //     { model: models.facility, attributes: ["id", "name"] },
    //     { model: models.reservation, attributes: ["id"] },
    //   ],
    // });

    if (!review) {
      return res.status(404).json({
        Message: "리뷰가 존재하지 않습니다.",
        ResultCode: "ERR_NOT_FOUND",
      });
    }

    // 응답(Response) 보내기
    res.status(200).json({
      Message: "Success",
      ResultCode: "OK",
      data: review,
    });
  } catch (err) {
    //bad request
    console.error("getReview error:", err);
    res.status(500).json({
      Message: "서버 에러",
      ResultCode: "ERR_SERVER",
      Error: err.toString(),
    });
  }
}
module.exports = {
  getReview,
  getReviews,
  updateReview,
};
