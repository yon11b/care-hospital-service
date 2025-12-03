const models = require("../../models");
const sha256 = require("sha256");
const { Op } = require("sequelize");
const app = require("../../app");

// ========================================
// 1. 회원 가입 차단 실행/해제 -> 블랙리스트
// ========================================
const USER_STATUS = {
  NORMAL: "normal",
  BLACKLIST: "blacklist",
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
        Message: "User not found",
        ResultCode: "USER_NOT_FOUND",
      });
    }

    // 2. 이미 블랙리스트 상태라면
    if (targetUser.status === USER_STATUS.BLACKLIST) {
      return res.status(400).json({
        Message: "User is already blocked",
        ResultCode: "USER_ALREADY_BLOCKED",
      });
    }

    // 3. 차단 처리
    targetUser.status = USER_STATUS.BLACKLIST;
    await targetUser.save();

    // 4. 응답
    return res.json({
      Message: "User has been blocked successfully",
      ResultCode: "OK",
      user: {
        id: targetUser.id,
        name: targetUser.name,
        status: targetUser.status,
      },
    });
  } catch (err) {
    console.error("admin - addUserToBlacklist err:", err.message);
    res.status(500).json({
      Message: "Internal server error",
      ResultCode: "ERR_INTERNAL_SERVER",
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
        Message: "User not found",
        ResultCode: "USER_NOT_FOUND",
      });
    }

    // 2. 블랙리스트 상태가 아니면 해제할 필요 없음
    if (targetUser.status !== USER_STATUS.BLACKLIST) {
      return res.status(400).json({
        Message: "User is not blacklisted",
        ResultCode: "USER_NOT_BLACKLISTED",
      });
    }

    // 3. 차단 해제 처리
    targetUser.status = USER_STATUS.NORMAL;
    await targetUser.save();

    // 4. 성공 응답
    return res.json({
      Message: "User has been unblocked successfully",
      ResultCode: "OK",
      user: {
        id: targetUser.id,
        name: targetUser.name,
        status: targetUser.status,
      },
    });
  } catch (err) {
    console.error("admin - removeUserFromBlacklist err:", err.message);
    res.status(500).json({
      Message: "Internal server error",
      ResultCode: "ERR_INTERNAL_SERVER",
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
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;
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
    const { count: totalCount, rows: users } =
      await models.user.findAndCountAll({
        where,
        order: [[sortBy, sortOrder]],
        limit,
        offset,
        attributes: ["id", "name", "email", "phone", "status", "created_at"],
      });

    res.json({
      Message: "Users list successfully",
      ResultCode: "OK",
      pagination: {
        total: totalCount,
        page,
        limit,
        totalPages: Math.ceil(totalCount / limit),
        totalCount,
      },
      data: users,
    });
  } catch (err) {
    console.error("admin - getUsersList err:", err.message);
    res.status(500).json({
      Message: "Internal server error",
      ResultCode: "ERR_INTERNAL_SERVER",
      msg: err.toString(),
    });
  }
}

// 2-2. 회원(사용자) 상세 조회
// GET /admin/members/users/:userId
async function getUserDetail(req, res) {
  try {
    const userId = parseInt(req.params.userId, 10);
    if (isNaN(userId)) {
      return res.status(400).json({
        ResultCode: "ERR_INVALID_PARAM",
        Message: "Invalid userId parameter",
      });
    }

    // 1. 사용자 기본 정보 + 연결된 SNS
    const userInfo = await models.user.findOne({
      where: { id: userId },
      include: [
        {
          model: models.user_sns,
          attributes: ["provider"],
          required: false,
        },
      ],
      attributes: ["id", "name", "email", "phone", "status", "created_at"],
    });

    if (!userInfo) {
      return res.status(404).json({
        ResultCode: "ERR_NOT_FOUND",
        Message: "User not found",
      });
    }

    // 2. 사용자 활동 통계 (Promise.all로 동시에 조회)
    const [reservationCount, communityCount, commentCount, reviewStats] =
      await Promise.all([
        models.reservation.count({ where: { user_id: userId } }),
        models.community.count({ where: { user_id: userId } }),
        models.comment.count({ where: { user_id: userId } }),
        models.review.findOne({
          where: { user_id: userId },
          attributes: [
            [
              models.review.sequelize.fn(
                "COUNT",
                models.review.sequelize.col("id")
              ),
              "count",
            ],
            [
              models.review.sequelize.fn(
                "AVG",
                models.review.sequelize.col("rating")
              ),
              "avgRating",
            ],
          ],
          raw: true,
        }),
      ]);

    const reviewsCount = Number(reviewStats.count || 0);
    const reviewsAvgRating = Number(reviewStats.avgRating || 0).toFixed(2);

    // 3. 응답 구성
    res.status(200).json({
      ResultCode: "OK",
      Message: "User detail successfully",
      data: {
        user: userInfo,
        summary: {
          reservations_count: reservationCount,
          reviews_count: reviewsCount,
          reviews_avg_rating: reviewsAvgRating,
          community_posts_count: communityCount,
          comments_count: commentCount,
        },
      },
    });
  } catch (err) {
    console.error("admin - getUserDetail err:", err);
    res.status(500).json({
      Message: "Internal server error",
      ResultCode: "ERR_INTERNAL_SERVER",
      msg: err.toString(),
    });
  }
}
// ========================================
// 3. 회원(기관) 목록 조회 및 상세 조회
// ========================================
// 3-1. 회원(기관 대표, 직원) 목록 조회 경우 1
// | 기관명 | 이름 | 직급 | 상태 | 등록일 |
// GET /admin/members/staffs
async function getStaffsList(req, res) {
  try {
    // 페이지네이션
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    // 검색 및 필터
    const keyword = req.query.keyword || "";
    const role = req.query.role || "";
    const approval_status = req.query.approval_status; // 승인 상태

    // 안전한 정렬
    const allowedSortColumns = ["created_at", "name", "email", "role"];
    const sortBy = allowedSortColumns.includes(req.query.sortBy)
      ? req.query.sortBy
      : "created_at";
    const sortOrder = req.query.sortOrder === "ASC" ? "ASC" : "DESC";

    // 직원 조건 (role=staff or owner)
    const staffWhere = {
      role: { [Op.in]: ["staff", "owner", "admin"] },
    };
    if (approval_status) staffWhere.approval_status = approval_status;

    // 직원 + 기관 이름 통합 검색
    if (keyword) {
      staffWhere[Op.or] = [
        { name: { [Op.iLike]: `%${keyword}%` } }, // 직원 이름
        { email: { [Op.iLike]: `%${keyword}%` } }, // 직원 이메일
        { "$facility.name$": { [Op.iLike]: `%${keyword}%` } }, // 기관 이름
      ];
    }
    // 역할 검색
    if (role) {
      if (["staff", "owner"].includes(role)) {
        staffWhere.role = role;
      }
    }

    // 직원 기준 조회 + 전체 count (findAndCountAll)
    const { count: totalCount, rows: staffs } =
      await models.staff.findAndCountAll({
        where: staffWhere,
        include: [
          {
            model: models.facility,
            attributes: ["id", "name"],
            required: true, // 직원만 있는 기관
          },
        ],
        order: [
          [sortBy, sortOrder],
          ["role", "ASC"],
        ],
        limit,
        offset,
        distinct: true, // 중복 직원 제거
      });

    // 직원 배열 가공
    const staffList = staffs.map((s) => ({
      id: s.id,
      facility_id: s.facility?.id,
      facility_name: s.facility?.name || "", // 소속 기관
      role: s.role,
      name: s.name,
      email: s.email,
      approval_status: s.approval_status,
      created_at: s.created_at,
      updated_at: s.updated_at,
    }));

    res.json({
      ResultCode: "SUCCESS",
      Message: "기관 회원 목록 조회 성공",
      page,
      limit,
      totalPages: Math.ceil(totalCount / limit),
      totalCount,
      Result: staffList,
    });
  } catch (err) {
    console.error("admin - getStaffsList err:", err.message);
    res.status(500).json({
      Message: "Internal server error",
      ResultCode: "ERR_INTERNAL_SERVER",
      msg: err.toString(),
    });
  }
}
// 3-1-1. 회원(기관 대표, 직원) 상세 조회 (고민 중)

// 3-2. 회원(기관 대표, 직원) 목록 조회 경우 2
// | 기관명 | 대표 | 직원 수 | 승인 상태 | 생성일 |
// GET /admin/members/facilities
async function getFacilitiesList(req, res) {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const offset = (page - 1) * limit;
    const keyword = req.query.keyword || "";

    // 검색 조건
    const where = {};
    if (keyword) {
      where.name = { [Op.iLike]: `%${keyword}%` };
    }

    // 기관 조회 + 대표, 직원 수 포함
    const { count: totalCount, rows: facilities } =
      await models.facility.findAndCountAll({
        where,
        include: [
          {
            model: models.staff,
            attributes: ["role", "id"],
          },
        ],
        order: [["created_at", "DESC"]],
        limit,
        offset,
        distinct: true,
      });

    // 데이터 가공
    const data = facilities.map((f) => {
      const owner = f.staffs.find((s) => s.role === "owner");
      const staffCount = f.staffs.filter((s) => s.role === "staff").length;

      return {
        id: f.id,
        name: f.name,
        owner_name: owner?.name || "",
        staff_count: staffCount,
        approval_status: f.approval_status,
        created_at: f.created_at,
      };
    });

    res.json({
      ResultCode: "SUCCESS",
      Message: "기관 목록 조회 성공",
      data,
      pagination: {
        page,
        limit,
        totalPages: Math.ceil(totalCount / limit),
        totalCount,
      },
    });
  } catch (err) {
    console.error("admin - getFacilitiesList err:", err);
    res.status(500).json({
      ResultCode: "ERR_INTERNAL_SERVER",
      Message: "Internal server error",
      msg: err.toString(),
    });
  }
}

// 3-2-1. 회원(기관 대표, 직원) 상세 조회
// | 이름 | 이메일 | 역할 | 승인 상태 | 가입일
// GET /admin/members/facilities/:facilityId
async function getFacilityStaffs(req, res) {
  try {
    const facilityId = parseInt(req.params.facilityId, 10);
    if (isNaN(facilityId)) {
      return res.status(400).json({
        ResultCode: "ERR_INVALID_PARAM",
        Message: "Invalid facilityId parameter",
      });
    }

    const staffs = await models.staff.findAll({
      where: { facility_id: facilityId },
      attributes: [
        "id",
        "name",
        "email",
        "role",
        "approval_status",
        "created_at",
      ],
      order: [
        ["role", "ASC"],
        ["created_at", "ASC"],
      ],
    });

    res.json({
      ResultCode: "SUCCESS",
      Message: "직원 목록 조회 성공",
      data: staffs,
    });
  } catch (err) {
    console.error("admin - getFacilityStaffs err:", err);
    res.status(500).json({
      ResultCode: "ERR_INTERNAL_SERVER",
      Message: "Internal server error",
      msg: err.toString(),
    });
  }
}
// 삭제 API (params 사용)
async function deleteMember(req, res) {
  try {
    const { id } = req.params; // params에서 id 받기
    const { role } = req.query;
    if (!id || !role) {
      return res
        .status(400)
        .json({ result: false, msg: "id와 role이 필요합니다." });
    }

    if (role === "staff" || role === "owner") {
      const existingStaff = await models.staff.findOne({ where: { id } });
      if (!existingStaff) {
        return res
          .status(404)
          .json({ result: false, msg: "직원을 찾을 수 없습니다." });
      }

      await models.staff.destroy({ where: { id } });
      return res
        .status(200)
        .json({ result: true, msg: "직원이 삭제되었습니다." });
    } else if (role === "user") {
      const existingUser = await models.users.findOne({ where: { id } });
      if (!existingUser) {
        return res
          .status(404)
          .json({ result: false, msg: "사용자를 찾을 수 없습니다." });
      }

      // user_sns 삭제
      await models.user_sns.destroy({ where: { user_id: id } });

      // users 삭제
      await models.users.destroy({ where: { id } });
      return res
        .status(200)
        .json({ result: true, msg: "사용자가 삭제되었습니다." });
    } else {
      return res.status(400).json({ result: false, msg: "잘못된 role입니다." });
    }
  } catch (err) {
    console.error(err);
    return res.status(500).json({ result: false, msg: err.toString() });
  }
}

// 승인 상태 변경
async function updateStaffStatus(req, res) {
  try {
    const { id, name, password, email, phone, role, approval_status } =
      req.body;

    if (id) {
      // 기존 사용자 업데이트
      const existingUser = await models.staff.findOne({
        where: {
          id,
        },
      });
      if (!existingUser) {
        return res
          .status(404)
          .json({ result: false, msg: "사용자를 찾을 수 없습니다." });
      }
      const updateData = {};
      if (name) updateData.name = name;
      if (password) updateData.password = password; // 이미 해시 처리한 경우
      if (email) updateData.email = email;
      if (phone) updateData.phone = phone;
      if (role) updateData.role = role;
      if (approval_status) updateData.approval_status = approval_status;

      await models.staff.update(updateData, {
        where: { id },
      });
      return res
        .status(200)
        .json({ result: true, msg: "사용자 정보가 수정되었습니다." });
    }
  } catch (err) {
    console.error(err);
    return res.status(400).json({ result: false, msg: err.toString() });
  }
}
// 승인 상태 변경
async function updateUserStatus(req, res) {
  try {
    const { id, name, password, phone, email, role, status } = req.body;

    if (id) {
      // 기존 사용자 업데이트
      const existingUser = await models.user.findOne({
        where: {
          id,
        },
      });
      if (!existingUser) {
        return res
          .status(404)
          .json({ result: false, msg: "사용자를 찾을 수 없습니다." });
      }
      const updateData = {};
      if (name) updateData.name = name;
      if (password) updateData.password = password; // 이미 해시 처리한 경우
      if (email) updateData.email = email;
      if (phone) updateData.phone = phone;
      if (role) updateData.role = role;
      if (status) updateData.status = status;

      await models.user.update(updateData, {
        where: { id },
      });
      return res.status(200).json({ result: true });
    }
  } catch (err) {
    console.error(err);
    return res.status(400).json({ result: false, msg: err.toString() });
  }
}
module.exports = {
  addUserToBlacklist,
  removeUserFromBlacklist,
  getUsersList,
  getUserDetail,
  getStaffsList,
  //getStaffDetail,

  getFacilitiesList,
  getFacilityStaffs,
  updateStaffStatus,
  updateUserStatus,
  deleteMember,
};
