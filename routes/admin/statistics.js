const models = require("../../models");
const { Op } = require("sequelize");
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
        [sequelize.fn('TO_CHAR', sequelize.col('created_at'), 'YYYY-MM'), 'month'],
        [sequelize.fn('COUNT', sequelize.col('id')), 'count']
      ],
      group: ['month'],
      order: [[sequelize.col('month'), 'ASC']],
      raw: true
    });

    // 총 사용자 수
    const totalUsers = await models.user.count();

    // 통계 시작 달과 마지막 달 계산
    const months = monthlyStats.map(item => item.month);
    const firstMonth = months[0] || new Date().toISOString().slice(0, 7); // 첫 등록 달
    const lastMonth = new Date().toISOString().slice(0, 7); // 현재 달

    // 빈 달 포함하기
    const allMonths = [];
    let [year, month] = firstMonth.split('-').map(Number);
    const [lastYear, lastMonthNum] = lastMonth.split('-').map(Number);

    while (year < lastYear || (year === lastYear && month <= lastMonthNum)) {
      const m = `${year}-${String(month).padStart(2, '0')}`;
      allMonths.push(m);
      month++;
      if (month > 12) {
        month = 1;
        year++;
      }
    }

    // 결과 정리
    const result = {};
    allMonths.forEach(m => {
      const found = monthlyStats.find(item => item.month === m);
      result[m] = found ? Number(found.count) : 0;
    });

    res.json({
      Message: '월별 신규/총 이용자 수 조회 성공',
      ResultCode: 'SUCCESS',
      totalUsers,
      monthlyStats: result
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      Message: "월별 사용자 통계 조회 실패",
      ResultCode: 'ERR_INTERNAL_SERVER',
      error: err.message
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
    const confirmedCount = await models.reservation.count({ where: { ...where, status: 'CONFIRMED' } });
    const canceledCount = await models.reservation.count({ where: { ...where, status: 'CANCELED' } });
    const pendingCount = await models.reservation.count({ where: { ...where, status: 'PENDING' } });
    const rejectedCount = await models.reservation.count({ where: { ...where, status: 'REJECTED' } });

    // 일자별 통계
    const dailyStats = await models.reservation.findAll({
      where,
      attributes: [
        [sequelize.fn('DATE', sequelize.col('reserved_date')), 'date'],
        [sequelize.fn('COUNT', sequelize.col('id')), 'count']
      ],
      group: ['reserved_date'],
      order: [[sequelize.col('reserved_date'), 'ASC']],
      raw : true
    });
    dailyStats.forEach(d => d.count = Number(d.count));

    // 질병유형별 통계
    // 데이터가 존재하는 disease_type만 반환
    let byDisease = await models.reservation.findAll({
      where,
      attributes: [
        'disease_type',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count']
      ],
      group: ['disease_type'],
      raw: true
    });

    // ENUM 기준으로 없는 항목 채우기
    const diseaseTypes = ['치매','재활','파킨슨','뇌혈관성질환','중풍','암','기타'];
    byDisease = diseaseTypes.map(type => {
    const found = byDisease.find(d => d.disease_type === type);
    return { disease_type: type, count: found ? Number(found.count) : 0 };
    });

    res.json({
      Message: '예약 현황 조회 성공',
      ResultCode: 'SUCCESS',
      filters: { startDate, endDate },
      summary: {
        totalCount,
        confirmedCount,
        canceledCount,
        pendingCount,
        rejectedCount
      },
      dailyStats,
      byDisease
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ 
      Message: '예약 통계 조회 실패',
      ResultCode: 'ERR_INTERNAL_SERVER',       
      error 
    });
  }
};

// 1-4. 상담 현황 조회
// GET /admin/statistics/chat



module.exports = { 
    getReservationStatistics,
    getMonthlyUsers,
    
};