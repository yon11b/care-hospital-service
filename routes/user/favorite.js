const models = require("../../models");
const sha256 = require("sha256");
const app = require("../../app");
const sequelize = require("sequelize");
const AWS = require("aws-sdk");
const { literal, Op } = require("sequelize");

// ============================
// 관심 등록
// ============================
// 1. 나의 관심 기관 목록 조회
// GET /user/:userId/favorites
async function getfavorites(req, res) {
  try {
    const userId = parseInt(req.params.userId, 10);
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const offset = (page - 1) * limit;

    if (isNaN(userId)) {
      return res.status(400).json({
        Message: "Invalid userId parameter",
        ResultCode: "ERR_INVALID_PARAM",
      });
    }

    // 로그인 확인
    if (!req.user) {
      return res.status(401).json({
        Message: "Unauthorized - 로그인 필요",
        ResultCode: "ERR_UNAUTHORIZED",
      });
    }

    // 본인 여부 확인
    if (req.user.id !== userId) {
      return res.status(403).json({
        Message: "Forbidden - 본인만 조회 가능합니다",
        ResultCode: "ERR_FORBIDDEN",
      });
    }

    // 1) 총 관심 기관 개수
    const totalCount = await models.like.count({ where: { user_id: userId } });
    const hasNext = page * limit < totalCount;

    // 2) DB에서 likes 기준으로 관심기관 페이징 조회
    const favorites = await models.facility.findAll({
      include: [
        {
          model: models.user,
          as: "users", // association alias
          where: { id: userId },
          attributes: [],
          through: { attributes: ["created_at"] }, // through alias
        },
      ],
      attributes: {
        include: [
          // 리뷰 평균
          [
            models.sequelize.literal(`(
              SELECT ROUND(COALESCE(AVG(rating), 0)::numeric, 1)
              FROM reviews AS review
              WHERE review.facility_id = facility.id
                AND review.status IN ('ACTION', 'REPORT_PENDING')
            )`),
            "avg_rating",
          ],
          // 리뷰 수
          [
            models.sequelize.literal(`(
              SELECT COUNT(*)
              FROM reviews AS review
              WHERE review.facility_id = facility.id
                AND review.status IN ('ACTION', 'REPORT_PENDING')
            )`),
            "review_count",
          ],
        ],
      },
      order: [[models.sequelize.literal('"users->like"."created_at"'), "DESC"]],
      limit,
      offset,
      subQuery: false,
    });

    return res.status(200).json({
      Message: "관심 등록 기관 목록 조회 성공",
      ResultCode: "SUCCESS",
      data: favorites.map((f) => ({
        id: f.id,
        name: f.name,
        address: f.address || null,
        phone: f.telno || null,
        avg_rating: parseFloat(f.get("avg_rating")),
        review_count: parseInt(f.get("review_count"), 10),
        created_at: f.created_at,
        updated_at: f.updated_at,
      })),
      page,
      limit,
      total_count: totalCount,
      has_next: hasNext,
    });
  } catch (err) {
    console.error("getfavorites error:", err);
    return res.status(500).json({
      Message: "Internal server error",
      ResultCode: "ERR_INTERNAL_SERVER",
      msg: err.toString(),
    });
  }
}
// 2. 특정 기관 "관심 등록/해제" (토글)
// POST /user/:userId/favorites/:facilityId
async function toggleFavorite(req, res) {
  try {
    const userId = parseInt(req.params.userId, 10);
    const facilityId = parseInt(req.params.facilityId, 10);

    if (isNaN(userId) || isNaN(facilityId)) {
      return res.status(400).json({
        Message: "Invalid parameter",
        ResultCode: "ERR_INVALID_PARAM",
      });
    }

    // 로그인 확인
    if (!req.user) {
      return res.status(401).json({
        Message: "Unauthorized - 로그인 필요",
        ResultCode: "ERR_UNAUTHORIZED",
      });
    }

    // 본인 여부 확인
    if (req.user.id !== userId) {
      return res.status(403).json({
        Message: "Forbidden - 본인만 가능합니다",
        ResultCode: "ERR_FORBIDDEN",
      });
    }

    // 기관 여부 확인
    const facility = await models.facility.findByPk(facilityId);
    if (!facility) {
      return res.status(404).json({
        Message: "기관이 존재하지 않습니다.",
        ResultCode: "ERR_NOT_FOUND",
      });
    }

    // 좋아요 토글
    const [like, created] = await models.like.findOrCreate({
      where: { user_id: userId, facility_id: facilityId },
      defaults: { user_id: userId, facility_id: facilityId },
    });

    if (!created) {
      // 이미 등록되어 있으면 삭제
      await like.destroy();
    }

    return res.status(200).json({
      Message: created ? "관심 등록 성공" : "관심 등록 해제 성공",
      ResultCode: "SUCCESS",
      favorited: created, // 프론트 하트 색상용
    });
  } catch (err) {
    console.error("toggleFavorite error:", err);
    return res.status(500).json({
      Message: "Internal server error",
      ResultCode: "ERR_INTERNAL_SERVER",
      msg: err.toString(),
    });
  }
}

module.exports = {
  getfavorites,
  toggleFavorite,
};
