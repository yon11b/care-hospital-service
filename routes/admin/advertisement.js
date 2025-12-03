const models = require("../../models");
const sha256 = require("sha256");
const { Op } = require("sequelize");
const app = require("../../app");

// 한국 시간으로 바꾸기 (YYYY-MM-DD HH:mm:ss)
function formatDateKST(date) {
  if (!date) return null;
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");
  const seconds = String(d.getSeconds()).padStart(2, "0");
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

// 1. 관리자 측에서 신청된 광고 전체 목록 조회
// GET /admin/advertisements
async function getFacilityAds(req, res) {
  try {
    // 쿼리에서 페이지, limit, 키워드 받아오기
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const offset = (page - 1) * limit;
    const keyword = req.query.keyword || "";

    // 광고 조회 (facility, staff 정보 포함)
    const { rows: ads, count: total } =
      await models.advertisement.findAndCountAll({
        where: {
          description: { [Op.iLike]: `%${keyword}%` },
        },
        include: [
          {
            model: models.facility,
            attributes: ["id", "name"], // 기관 id, 이름만 가져오기
          },
          {
            model: models.staff,
            attributes: ["id", "name"], // 사용자 id, 이름만 가져오기
          },
        ],
        order: [["created_at", "DESC"]],
        limit,
        offset,
      });

    // 결과 생성
    const data = ads.map((ad) => ({
      id: ad.id,
      description: ad.description,
      approval_status: ad.approval_status,
      start_date: ad.start_date,
      end_date: ad.end_date,
      approved_at: ad.approved_at,
      facility: ad.facility
        ? { id: ad.facility.id, name: ad.facility.name }
        : null,
      user: ad.staff ? { id: ad.staff.id, name: ad.staff.name } : null,
    }));

    // 성공 응답
    res.status(200).json({
      Message: "admin - 광고 목록 조회 성공",
      ResultCode: "SUCCESS",
      page,
      limit,
      total,
      data,
    });
  } catch (err) {
    console.error("admin - getFacilityAds err:", err.message);
    res.status(500).json({
      Message: "Internal server error",
      ResultCode: "ERR_INTERNAL_SERVER",
      msg: err.toString(),
    });
  }
}

// 2. 관리자 측에서 광고 상세(1개) 조회
// GET /admin/advertisements/{adId}
async function getFacilityAdsDetail(req, res) {
  try {
    const adId = parseInt(req.params.adId, 10);

    // 관리자 로그인 및 권한 체크는 미들웨어에서 처리됨
    if (isNaN(adId)) {
      return res.status(400).json({
        Message: "유효하지 않은 파라미터",
        ResultCode: "ERR_INVALID_PARAMETER",
      });
    }

    // 광고 하나 조회 (facility, staff 정보 포함)
    const ad = await models.advertisement.findOne({
      where: { id: adId },
      include: [
        {
          model: models.facility,
          attributes: ["id", "name", "address", "telno", "kind"],
        },
        {
          model: models.staff,
          attributes: ["id", "name"],
        },
      ],
    });

    if (!ad) {
      return res.status(404).json({
        Message: "해당 광고를 찾을 수 없습니다.",
        ResultCode: "NOT_AD_FOUND",
      });
    }

    // 결과 생성
    const adDetail = {
      id: ad.id,
      description: ad.description,
      approval_status: ad.approval_status,
      application_date: ad.created_at, // 광고 신청일
      approved_at: ad.approved_at, // 상태변경일
      start_date: ad.start_date, // 노출 시작
      end_date: ad.end_date, // 노출 종료
      updated_at: ad.updated_at,
      facility: ad.facility
        ? {
            id: ad.facility.id,
            name: ad.facility.name,
            address: ad.facility.address,
            telno: ad.facility.telno,
            kind: ad.facility.kind,
          }
        : null,
      user: ad.staff
        ? {
            id: ad.staff.id,
            name: ad.staff.name,
          }
        : null,
    };

    // 성공 응답
    res.status(200).json({
      Message: "admin - 광고 상세 조회 성공",
      ResultCode: "SUCCESS",
      data: adDetail,
    });
  } catch (err) {
    console.error("admin - getFacilityAdsDetail err:", err.message);
    res.status(500).json({
      Message: "Internal server error",
      ResultCode: "ERR_INTERNAL_SERVER",
      msg: err.toString(),
    });
  }
}

// 3. 승인/거절 (APPROVED / REJECTED)
// PATCH /admin/advertisements/{adId}
async function approveOrRejectAd(req, res) {
  try {
    const adId = parseInt(req.params.adId, 10);
    const { status } = req.body; // status: 'APPROVED' | 'REJECTED'

    // 관리자 로그인 및 권한 체크는 미들웨어에서 처리됨

    if (isNaN(adId)) {
      return res.status(400).json({
        Message: "유효하지 않은 파라미터",
        ResultCode: "ERR_INVALID_PARAMETER",
      });
    }

    // 승인/거절 상태 유효성 체크
    if (!["approved", "rejected"].includes(status)) {
      return res.status(400).json({
        Message: "status는 'approved' 또는 'rejected'만 가능합니다.",
        ResultCode: "ERR_INVALID_STATUS",
      });
    }

    // 1. 광고 1개 조회
    const ad = await models.advertisement.findOne({
      where: { id: adId },
    });

    if (!ad)
      return res.status(404).json({
        Message: "신청한 광고가 존재하지 않습니다.",
        ResultCode: "ERR_NOT_FOUND",
      });

    // 2. 승인 or 거절 처리하기
    // 2-1. pending 상태의 신청 내역만 처리 가능
    // if (ad.approval_status !== "pending") {
    //   return res.status(400).json({
    //     Message: `이미 처리된 광고입니다. 현재 상태: ${ad.approval_status}`,
    //     ResultCode: "ERR_ALREADY_PROCESSED",
    //   });
    // }

    // 2-2. 상태 변경
    ad.approval_status = status;
    ad.approved_at = new Date(); // 현재 시간
    await ad.save();

    // 3. 응답
    res.status(200).json({
      Message: `광고가 ${status === "approved" ? "승인" : "거절"} 처리되었습니다.`,
      ResultCode: "SUCCESS",
      data: {
        id: ad.id,
        approval_status: ad.approval_status,
        approved_at: formatDateKST(ad.approved_at),
      },
    });
  } catch (err) {
    console.error("admin - approveOrRejectAd err:", err.message);
    res.status(500).json({
      Message: "Internal server error",
      ResultCode: "ERR_INTERNAL_SERVER",
      msg: err.toString(),
    });
  }
}

module.exports = {
  getFacilityAds,
  getFacilityAdsDetail,
  approveOrRejectAd,
};
