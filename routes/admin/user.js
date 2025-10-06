const models = require("../../models");
const sha256 = require("sha256");
const { Op } = require("sequelize");
const app = require("../../app");

// ========================================
// 1. 회원 가입 차단 실행/해제 -> 블랙리스트
// ========================================
const USER_STATUS = {
  NORMAL: 'normal',
  BLACKLIST: 'blacklist',
};
// 1-1. 회원 가입 차단 실행
// POST /admin/user/:userId/block
async function addUserToBlacklist(req, res) {
  try {
    const { userId } = req.params;

    // 관리자 로그인 및 권한 체크는 미들웨어에서 처리됨

    // 1. 해당 사용자 조회
    const targetUser = await models.user.findByPk(userId);

    if (!targetUser) {
      return res.status(404).json({        
        Message: 'User not found',
        ResultCode: 'USER_NOT_FOUND',
      });
    }

    // 2. 이미 블랙리스트 상태라면
    if (targetUser.status === USER_STATUS.BLACKLIST) {
      return res.status(400).json({
        Message: 'User is already blocked',
        ResultCode: 'USER_ALREADY_BLOCKED',
      });
    }

    // 3. 차단 처리
    targetUser.status = USER_STATUS.BLACKLIST;
    await targetUser.save();

    // 4. 응답
    return res.json({
      Message: 'User has been blocked successfully',
      ResultCode: 'OK',
      user: {
        id: targetUser.id,
        name: targetUser.name,
        status: targetUser.status,
      },
    });    
  } catch (err) {
    console.error('admin - addUserToBlacklist err:', err.message);
    res.status(500).json({
      Message: 'Internal server error',
      ResultCode: 'ERR_INTERNAL_SERVER',
      msg: err.toString(),
    });
  }
}
// 1-2. 회원 가입 차단 해제
// DELETE /admin/user/:userId/block
async function removeUserFromBlacklist(req, res) {
  try {
    const { userId } = req.params;

    // 관리자 권한 체크는 미들웨어에서 처리됨

    // 1. 사용자 조회
    const targetUser = await models.user.findByPk(userId);

    if (!targetUser) {
      return res.status(404).json({
        Message: 'User not found',
        ResultCode: 'USER_NOT_FOUND',
      });
    }

    // 2. 블랙리스트 상태가 아니면 해제할 필요 없음
    if (targetUser.status !== USER_STATUS.BLACKLIST) {
      return res.status(400).json({
        Message: 'User is not blacklisted',
        ResultCode: 'USER_NOT_BLACKLISTED',
      });
    }

    // 3. 차단 해제 처리
    targetUser.status = USER_STATUS.NORMAL;
    await targetUser.save();

    // 4. 성공 응답
    return res.json({
      Message: 'User has been unblocked successfully',
      ResultCode: 'OK',
      user: {
        id: targetUser.id,
        name: targetUser.name,
        status: targetUser.status,
      },
    });
  } catch (err) {
    console.error('admin - removeUserFromBlacklist err:', err.message);
    res.status(500).json({
      Message: 'Internal server error',
      ResultCode: 'ERR_INTERNAL_SERVER',
      msg: err.toString(),
    });
  }
}
// ========================================
// 2. 회원(사용자) 목록 조회 및 상세 조회
// ========================================
// 2-1. 회원(사용자) 목록 조회 (페이징 + 상태 + 검색)
// GET /admin/members/users
async function getUsersList(req, res) {
  try {
    const page = parseInt(req.query.page) || 1;
    const size = parseInt(req.query.size) || 20;
    const offset = (page - 1) * size;
    const keyword = req.query.keyword;
    const status = req.query.status; // normal / blacklist
    const sortBy = req.query.sortBy || "created_at"; // 정렬 컬럼
    const sortOrder = req.query.sortOrder === "ASC" ? "ASC" : "DESC"; // ASC or DESC

    // 관리자 로그인 및 권한 체크는 미들웨어에서 처리됨

    // 조건 객체
    const where = {};
    if (keyword) {
      where[Op.or] = [
        { name: { [Op.iLike]: `%${keyword}%` } },
        { email: { [Op.iLike]: `%${keyword}%` } },
        { phone: { [Op.iLike]: `%${keyword}%` } },
      ];
    }
    if (status) {
      where.status = status;
    }

    // 조회
    const { count: totalUsers, rows: users } = await models.user.findAndCountAll({
      where,
      order: [[sortBy, sortOrder]],
      limit: size,
      offset,
      attributes: ["id", "name", "email", "phone", "status", "created_at"],
    });

    res.json({
      Message: "Users list successfully",
      ResultCode: "OK",
      pagination: {
        total: totalUsers,
        page: page,
        size: size,
        totalPages: Math.ceil(totalUsers / size),
      },
      data: users,
    });
  } catch (err) {
    console.error('admin - getUsersList err:', err.message);
    res.status(500).json({
      Message: 'Internal server error',
      ResultCode: 'ERR_INTERNAL_SERVER',
      msg: err.toString(),
    });
  }
}
// 2-2. 회원(사용자) 상세 조회
// GET /admin/members/users/:userId
async function getUserDetail (req, res) {
  try {
    const userId = parseInt(req.params.userId, 10);
    if (isNaN(userId)) {
      return res.status(400).json({
        ResultCode: 'ERR_INVALID_PARAM',
        Message: 'Invalid userId parameter'
      });
    }

    // 1. 기본 회원 정보 + 연결된 sns
    const user = await models.user.findByPk(userId, {
      attributes: ['id','name','email','phone','status','facilityLikes','currentLocation','created_at'],
      include: [
        {
          model: models.user_sns,
          attributes: ['provider', 'sns_id'], // 어떤 SNS를 연결했는지
        }
      ]
    });

    if (!user) {
      return res.status(404).json({
        ResultCode: 'ERR_NOT_FOUND',
        Message: 'User not found'
      });
    }

    // 2. 요약 정보 (예약수, 리뷰수, 평균 리뷰 점수, 댓글 수, 신고 한 횟수 )
    const [reservationsCount, reviewsData, communityPostsCount, commentsCount, reportsCount] = await Promise.all([
      models.reservation.count({ where: { user_id: userId } }),
      models.review.findAll({ 
        where: { user_id: userId },
        attributes: [
          [models.sequelize.fn('COUNT', models.sequelize.col('id')), 'count'],
          [models.sequelize.fn('AVG', models.sequelize.col('rating')), 'avgRating']
        ],
        raw: true
      }),
      models.community.count({ where: { user_id: userId } }),
      models.comment.count({ where: { user_id: userId } }),
      models.report.count({ where: { user_id: userId } }) // 신고한 횟수
    ]);

    const reviewsCount = reviewsData[0]?.count || 0;
    const reviewsAvgRating = parseFloat(reviewsData[0]?.avgRating || 0);

    // 4. 받은 신고 내역 (reports_received)
    const reportsReceived = await models.report.findAll({
      where: { target_id: { [Op.in]: models.sequelize.literal(`(
        SELECT id FROM reviews WHERE user_id = ${userId}
        UNION
        SELECT id FROM communities WHERE user_id = ${userId}
        UNION
        SELECT id FROM comments WHERE user_id = ${userId}
      )`) } },
      order: [['created_at', 'DESC']],
      limit: 5,
      attributes: ['id','type','target_id','category','reason','status','created_at','resolved_at']
    });

    const reportsReceivedCount = await models.report.count({
      where: { target_id: { [Op.in]: models.sequelize.literal(`(
        SELECT id FROM reviews WHERE user_id = ${userId}
        UNION
        SELECT id FROM communities WHERE user_id = ${userId}
        UNION
        SELECT id FROM comments WHERE user_id = ${userId}
      )`) } }
    });

    // 응답
    res.json({
      ResultCode: 'OK',
      Message: 'User detail successfully',
      data: {
        user,
        summary: {
          reservations_count: reservationsCount, // 예약수
          // 상담수
          reviews_count: reviewsCount, // 리뷰 수
          reviews_avg_rating: reviewsAvgRating, // 평균 평점
          community_posts_count: communityPostsCount, // 커뮤니티 글 수
          comments_count: commentsCount, // 댓글 수
          reports_count: reportsCount, // 내가 신고한 수
          reports_received_count: reportsReceivedCount // 신고 받은 총 횟수
        },
        reports_received: reportsReceived // 최근 내가 받은 신고 내역 5개
      }
    });

  } catch (err) {
    console.error('admin - getUserDetail err:', err.message);
    res.status(500).json({
      Message: 'Internal server error',
      ResultCode: 'ERR_INTERNAL_SERVER',
      msg: err.toString(),
    });
  }
}
module.exports = { 
    addUserToBlacklist,
    removeUserFromBlacklist,
    getUsersList,
    getUserDetail,
};