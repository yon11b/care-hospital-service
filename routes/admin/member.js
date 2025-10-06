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

    // 3. 받은 신고 내역 (reports_received)
    const reportsReceived = await models.report.findAll({
      include: [
        {
          model: models.review,
          required: false,
          where: { user_id: userId },
          attributes: []
        },
        {
          model: models.community,
          required: false,
          where: { user_id: userId },
          attributes: []
        },
        {
          model: models.comment,
          required: false,
          where: { user_id: userId },
          attributes: []
        }
      ],
      order: [['created_at', 'DESC']],
      limit: 5,
      attributes: ['id','type','target_id','category','reason','status','created_at','resolved_at']
    });

    // 4. 받은 신고 총 개수
    const reportsReceivedCount = await models.report.count({
      include: [
        { model: models.review, required: false, where: { user_id: userId } },
        { model: models.community, required: false, where: { user_id: userId } },
        { model: models.comment, required: false, where: { user_id: userId } }
      ]
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
// ========================================
// 3. 회원(기관) 목록 조회 및 상세 조회
// ========================================
// 3-1. 회원(기관 대표, 직원) 목록 조회
// GET /admin/members/facilities
async function getStaffsList(req, res) {
  try {
    // 페이지네이션
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    // 검색 및 필터
    const keyword = req.query.keyword || '';
    const approval_status = req.query.approval_status; // 승인 상태

    // 안전한 정렬
    const allowedSortColumns = ['created_at', 'name', 'email', 'role'];
    const sortBy = allowedSortColumns.includes(req.query.sortBy) ? req.query.sortBy : 'created_at';
    const sortOrder = req.query.sortOrder === 'ASC' ? 'ASC' : 'DESC';

    // 직원 조건 (role=staff or owner)
    const staffWhere = {
      role: { [Op.in]: ['staff', 'owner'] },
    };
    if (approval_status) staffWhere.approval_status = approval_status;

    // 직원 + 기관 이름 통합 검색
    if (keyword) {
      staffWhere[Op.or] = [
        { name: { [Op.iLike]: `%${keyword}%` } },       // 직원 이름
        { email: { [Op.iLike]: `%${keyword}%` } },      // 직원 이메일
        { '$facility.name$': { [Op.iLike]: `%${keyword}%` } }, // 기관 이름
      ];
    }

    // 직원 기준 조회 + 전체 count (findAndCountAll)
    const { count: totalCount, rows: staffs } = await models.staff.findAndCountAll({
      where: staffWhere,
      include: [
        {
          model: models.facility,
          attributes: ['name'],
          required: true, // 직원만 있는 기관
        },
      ],
      order: [
        [sortBy, sortOrder],
        ['role', 'ASC'],
      ],
      limit,
      offset,
      distinct: true, // 중복 직원 제거
    });

    // 직원 배열 가공
    const staffList = staffs.map(s => ({
      facility_name: s.facility?.name || '', // 소속 기관
      role: s.role,
      name: s.name,
      email: s.email,
      approval_status: s.approval_status,
      created_at: s.created_at,
      updated_at: s.updated_at,
    }));

    res.json({
      ResultCode: 'SUCCESS',
      Message: '기관 회원 목록 조회 성공',
      data: staffList,
      pagination: {
        page,
        limit,
        totalPages: Math.ceil(totalCount / limit),
        totalCount,
      },
    });

  } catch (err) {
    console.error('admin - getStaffsList err:', err.message);
    res.status(500).json({
      Message: 'Internal server error',
      ResultCode: 'ERR_INTERNAL_SERVER',
      msg: err.toString(),
    });
  }
}
// 3-2. 회원(기관 대표, 직원) 상세 조회
// GET /admin/members/facilities/:staffId
async function getStaffDetail(req, res) {
  try {
    // 관리자 로그인 및 권한 체크는 미들웨어에서 처리됨

    // 경우1. 회원(기관 대표, 직원) 목록 조회 1개, 기관 목록 조회 1개

    /*
    경우 2. (기관명, 대표자, 승인 상태 등) 목록 조회에서 보여주고 
    상세보기를 누르면 해당 기관 안에 포함된 직원들과 상세 내역 보여주기 
    */
  } catch (err) {
    console.error('admin - getStaffDetail err:', err.message);
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
    getStaffsList,
    getStaffDetail
};