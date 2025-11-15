const models = require("../../models");
const { Op } = require("sequelize");
const { Sequelize } = require("sequelize");
const sequelize = models.sequelize;

// ========================================
// 1. 통계
// ========================================
// 1-1. 월별 신규/총 이용자(보호자/환자) 수
// GET /admin/statistics/monthly-users
async function getMonthlyUsers(req, res) {
  try {
    // 관리자 로그인 및 권한 체크는 미들웨어에서 처리됨

    // 전체 사용자 기준 월별 신규 통계
    const monthlyStats = await models.user.findAll({
      attributes: [
        [
          sequelize.fn("TO_CHAR", sequelize.col("created_at"), "YYYY-MM"),
          "month",
        ],
        [sequelize.fn("COUNT", sequelize.col("id")), "count"],
      ],
      group: ["month"],
      order: [[sequelize.col("month"), "ASC"]],
      raw: true,
    });

    // 총 사용자 수
    const totalUsers = await models.user.count();

    // 통계 시작 달과 마지막 달 계산
    const months = monthlyStats.map((item) => item.month);
    const firstMonth = months[0] || new Date().toISOString().slice(0, 7); // 첫 등록 달
    const lastMonth = new Date().toISOString().slice(0, 7); // 현재 달

    // 빈 달 포함하기
    const allMonths = [];
    let [year, month] = firstMonth.split("-").map(Number);
    const [lastYear, lastMonthNum] = lastMonth.split("-").map(Number);

    while (year < lastYear || (year === lastYear && month <= lastMonthNum)) {
      const m = `${year}-${String(month).padStart(2, "0")}`;
      allMonths.push(m);
      month++;
      if (month > 12) {
        month = 1;
        year++;
      }
    }

    // 결과 정리
    const result = {};
    allMonths.forEach((m) => {
      const found = monthlyStats.find((item) => item.month === m);
      result[m] = found ? Number(found.count) : 0;
    });

    res.json({
      Message: "월별 신규/총 이용자 수 조회 성공",
      ResultCode: "SUCCESS",
      totalUsers,
      monthlyStats: result,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      Message: "월별 사용자 통계 조회 실패",
      ResultCode: "ERR_INTERNAL_SERVER",
      error: err.message,
    });
  }
}
// 1-2. 예약 현황 조회
// GET /admin/statistics/reservations
// 전체 예약 수, 취소 수, 완료 수 등 요약
async function getReservationStatistics(req, res) {
  try {
    const { startDate, endDate } = req.query;

    // 관리자 로그인 및 권한 체크는 미들웨어에서 처리됨

    // 날짜 필터링
    const where = {};
    if (startDate && endDate) {
      where.reserved_date = { [Op.between]: [startDate, endDate] };
    } else if (startDate) {
      where.reserved_date = { [Op.gte]: startDate };
    } else if (endDate) {
      where.reserved_date = { [Op.lte]: endDate };
    }

    // 전체 요약 통계
    const totalCount = await models.reservation.count({ where });
    const confirmedCount = await models.reservation.count({
      where: { ...where, status: "CONFIRMED" },
    });
    const canceledCount = await models.reservation.count({
      where: { ...where, status: "CANCELED" },
    });
    const pendingCount = await models.reservation.count({
      where: { ...where, status: "PENDING" },
    });
    const rejectedCount = await models.reservation.count({
      where: { ...where, status: "REJECTED" },
    });

    // 일자별 통계
    const dailyStats = await models.reservation.findAll({
      where,
      attributes: [
        [sequelize.fn("DATE", sequelize.col("reserved_date")), "date"],
        [sequelize.fn("COUNT", sequelize.col("id")), "count"],
      ],
      group: ["reserved_date"],
      order: [[sequelize.col("reserved_date"), "ASC"]],
      raw: true,
    });
    dailyStats.forEach((d) => (d.count = Number(d.count)));

    // 질병유형별 통계
    // 데이터가 존재하는 disease_type만 반환
    let byDisease = await models.reservation.findAll({
      where,
      attributes: [
        "disease_type",
        [sequelize.fn("COUNT", sequelize.col("id")), "count"],
      ],
      group: ["disease_type"],
      raw: true,
    });

    // ENUM 기준으로 없는 항목 채우기
    const diseaseTypes = [
      "치매",
      "재활",
      "파킨슨",
      "뇌혈관성질환",
      "중풍",
      "암",
      "기타",
    ];
    byDisease = diseaseTypes.map((type) => {
      const found = byDisease.find((d) => d.disease_type === type);
      return { disease_type: type, count: found ? Number(found.count) : 0 };
    });

    res.json({
      Message: "예약 현황 조회 성공",
      ResultCode: "SUCCESS",
      filters: { startDate, endDate },
      summary: {
        totalCount,
        confirmedCount,
        canceledCount,
        pendingCount,
        rejectedCount,
      },
      dailyStats,
      byDisease,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      Message: "예약 통계 조회 실패",
      ResultCode: "ERR_INTERNAL_SERVER",
      error,
    });
  }
}

// 1-3. 월간 이용자 수 조회 함수
// GET /admin/statistics/monthly-active-users
async function getActiveUsers(req, res) {
  try {
    const result = await models.login_log.findAll({
      attributes: [
        // YYYY-MM 형태로 월 추출 (PostgreSQL 기준)
        [
          Sequelize.fn(
            "TO_CHAR",
            Sequelize.fn("DATE_TRUNC", "month", Sequelize.col("login_at")),
            "YYYY-MM"
          ),
          "month",
        ],
        [
          Sequelize.fn(
            "COUNT",
            Sequelize.fn("DISTINCT", Sequelize.col("user_id"))
          ),
          "active_users",
        ],
      ],
      group: [Sequelize.fn("DATE_TRUNC", "month", Sequelize.col("login_at"))],
      order: [
        [Sequelize.fn("DATE_TRUNC", "month", Sequelize.col("login_at")), "ASC"],
      ],
      raw: true,
    });
    return res.status(200).send({
      Message: "monthly active user number get successfully",
      ResultCode: "ERR_OK",
      Response: result,
    });
  } catch (err) {
    console.log(err);
    return res.status(500).send({
      Message: err.message || "Internal server error",
      ResultCode: "ERR_INTERNAL_SERVER",
      err,
    });
  }
}

// 1-4. 모든 회원 조회
// GET /admin/statistics/users
async function getUsers(req, res) {
  try {
    const staffUsers = await models.staff.findAll({
      attributes: [
        "id",
        "facility_id",
        "name",
        "email",
        "role",
        "approval_status",
        "created_at",
      ],
      raw: true,
    });

    const normalUsers = await models.user.findAll({
      attributes: ["id", "name", "email", "status", "created_at"],
      raw: true,
    });

    // 3️⃣ 통합 및 구분 표시
    const merged = [
      ...staffUsers.map((u) => ({
        ...u,
        status: u.approval_status, // approval_status → status
        approval_status: undefined, // 기존 키 제거
      })),
      ...normalUsers.map((u) => ({
        ...u,
        role: "user",
      })),
    ];

    // created_at 기준 내림차순 정렬
    merged.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    return res.status(200).json({
      Message: "Registered staff and users select successfully.",
      ResultCode: "ERR_OK",
      Size: merged.length,
      Response: merged,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      Message: "Failed to select staff and users.",
      ResultCode: "ERR_INTERNAL",
      msg: err.message || "Internal server error",
    });
  }
}

// 1-5. 기관, 사용자, 리뷰, 커뮤니티 개수
// GET /admin/statistics/datas
async function getDatas(req, res) {
  const { facility, user, review, community } = require("../../models"); // Sequelize 모델 import

  try {
    // 각 테이블 카운트
    const [facilityCount, userCount, reviewCount, communityCount] =
      await Promise.all([
        facility.count(),
        user.count(),
        review.count(),
        community.count(),
      ]);

    return res.json({
      Message: "Datas select successfully.",
      ResultCode: "ERR_OK",
      counts: {
        facilities: facilityCount,
        users: userCount,
        reviews: reviewCount,
        communities: communityCount,
      },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      Message: "서버 에러",
      ResultCode: "ERR_INTERNAL",
    });
  }
}

// 1-4. 상담 현황 조회
// GET /admin/statistics/chat

module.exports = {
  getReservationStatistics,
  getMonthlyUsers,
  getActiveUsers,
  getUsers,
  getDatas,
};
