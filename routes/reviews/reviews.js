// 사용자 입장에서의 리뷰 api

const models = require("../../models");
const sha256 = require("sha256");
const app = require("../../app");
const AWS = require("aws-sdk");
const { Op } = require("sequelize");
const { sequelize } = require("../../models");

// 1. 리뷰 전체 리스트 조회
// 작성자, 작성일, 내용, 이미지, 평점, 방문인증
// GET /reviews/:facilityId
async function getReviews(req, res) {
  try {
    const facilityId = parseInt(req.params.facilityId, 10);
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const offset = (page - 1) * limit;
    const sort = req.query.sort || "latest"; // latest(default) 또는 rating

    // 1. 파라미터 유효성 체크
    if (isNaN(limit) || limit <= 0 || limit > 50) {
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

    // 2. 기관 존재 여부 확인
    const facility = await models.facility.findByPk(facilityId);
    if (!facility) {
      return res.status(404).json({
        Message: "Facility not found",
        ResultCode: "ERR_NOT_FOUND",
      });
    }

    // 3. 조회 조건
    const where = {
      facility_id: facilityId,
      status: { [Op.in]: ["ACTION", "REPORT_PENDING"] },
    };

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
      where,
      order,
      limit,
      offset,
      attributes: ["id", "user_id", "content", "images", "rating", "visited", "created_at"],
      include: [{ model: models.user, attributes: ["id", "name"] }],
    });

    // 6. 다음 페이지 여부 체크
    const totalReviews = await models.review.count({ where });
    const hasNextPage = offset + reviews.length < totalReviews;

    // 7. 응답
    res.status(200).json({
      Message: "Success",
      ResultCode: "OK",
      data: reviews.map((r) => r.get({ plain: true })),
      page,
      limit,
      totalReviews,
      hasNextPage,
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

// 2. 리뷰 한개 상세 조회
// GET /reviews/:facilityId/:reviewId -> getReview,
async function getReview(req, res) {
  try {
    // 경로 파라미터에서 id 가져오기
    const facilityId = parseInt(req.params.facilityId, 10);
    const reviewId = parseInt(req.params.reviewId, 10);

    // 파라미터 확인
    if (isNaN(facilityId) || isNaN(reviewId)) {
      return res.status(400).json({
        Message: "Invalid parameters",
        ResultCode: "ERR_INVALID_PARAMS",
      });
    }

    const facility = await models.facility.findByPk(facilityId);
    if (!facility) {
      return res.status(404).json({
        Message: "기관이 존재하지 않습니다.",
        ResultCode: "ERR_FACILITY_NOT_FOUND",
      });
    }

    // 리뷰 조회 (작성자 정보 포함)
    const review = await models.review.findOne({
      where: {
        id: reviewId,
        facility_id: facilityId,
        status: { [Op.in]: ["ACTION", "REPORT_PENDING"] },
      },
      include: [
        {
          model: models.user,
          attributes: ["id", "name"], // 작성자 정보
        },
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

// =======================================
// 리뷰 생성/수정/삭제 후 통계 갱신 함수
// =======================================
async function updateFacilityStats(facilityId) {
  // findOne으로 AVG/COUNT 가져오기
  const stats = await models.review.findOne({
    where: { facility_id: facilityId, status: { [Op.in]: ["ACTION", "REPORT_PENDING"] } },
    attributes: [
      [sequelize.fn("AVG", sequelize.col("rating")), "average_rating"],
      [sequelize.fn("COUNT", sequelize.col("id")), "review_count"],
    ],
    raw: true,
  });

  if (!stats) return;

  const average_rating = parseFloat(stats.average_rating) || 0;
  const review_count = parseInt(stats.review_count) || 0;

  const [updated] = await models.facility.update(
    { average_rating, review_count },
    { where: { id: facilityId } }
  );

  if (updated === 0) {
    console.error("Facility stats update failed: no rows updated");
  }
}


// 3. 리뷰 생성  -> jwt 필요
// POST /reviews/:facilityId -> createReview,
// 사용자의 user_id -> jwt 토큰을 통해..
async function createReview(req, res) {
  try {
    const userId = req.user.id;
    const facilityId = parseInt(req.params.facilityId, 10);
    const { content, rating, reservationId } = req.body;

    // 로그인 확인
    if (!userId) {
      return res.status(401).send({
        Message: "Unauthorized - 로그인 필요",
        ResultCode: "ERR_UNAUTHORIZED",
      });
    }

    if (isNaN(facilityId)) {
      return res.status(400).json({
        Message: "Invalid facility ID",
        ResultCode: "ERR_INVALID_ID",
      });
    }

    const facility = await models.facility.findByPk(facilityId);
    if (!facility) {
      return res.status(404).json({
        Message: "Facility not found",
        ResultCode: "ERR_NOT_FOUND",
      });
    }

    // 필수 확인
    if (!content || rating == null) {
      return res.status(400).json({
        Message: "필수 항목이 누락되었습니다.",
        ResultCode: "ERR_BAD_REQUEST",
      });
    }

    // 평점 범위 확인
    if (rating < 1 || rating > 5) {
      return res.status(400).json({
        Message: "Invalid rating",
        ResultCode: "ERR_INVALID_RATING",
      });
    }

    // 방문 인증 - 예약 정보 확인
    // 방문 예약을 했고 reservation status가 CONFIRMED이면
    // 방문 인증 마크를 준다.
    let visited = false;

    if (reservationId) {
      const reservation = await models.reservation.findOne({
        where: {
          id: reservationId,
          facility_id: facilityId,
        },
      });

      // 예약 존재 여부 확인
      if (!reservation) {
        return res.status(404).json({
          Message: "해당 예약을 찾을 수 없습니다.",
          ResultCode: "ERR_RESERVATION_NOT_FOUND",
        });
      }

      // 예약자 본인인지 검증
      if (reservation.user_id !== userId) {
        return res.status(403).json({
          Message: "본인 예약만 리뷰를 작성할 수 있습니다.",
          ResultCode: "ERR_FORBIDDEN",
        });
      }

      // CONFIRMED 상태의 예약만 visited를 true로 바꾼다.
      // 나머지 상태의 예약은 false로 나둔다.
      if(reservation.status === "CONFIRMED"){
        // 예약 시간 경과 여부로 visited 판정
        if (reservation.reserved_date && reservation.reserved_time) {
          const reservationDateTime = new Date(
            `${reservation.reserved_date}T${reservation.reserved_time}+09:00`
          );
          visited = reservationDateTime < new Date();
        }
      }
    }

    // 업로드된 파일들에서 s3 url 뽑기
    // req.files 는 배열 형태 (upload.array)
    const imageUrls = Array.isArray(req.files)
      ? req.files.map((file) => file.location)
      : [];

    // db 저장
    const newReview = await models.review.create({
      user_id: userId,
      facility_id: facilityId,
      reservation_id : reservationId,
      content,
      rating,
      images: imageUrls,
      visited,
      reply: null, // 관리자 답변은 아직 없음 
    });

    // facility 테이블의 리뷰 평균 평점, 리뷰 개수 갱신
    try {
      await updateFacilityStats(newReview.facility_id);
    } catch(err) {
      console.error("Stats update failed:", err);
    }

    return res.status(201).json({
      Message: "리뷰가 성공적으로 등록되었습니다.",
      ResultCode: "SUCCESS",
      data: newReview.get({ plain: true }),
    });
  } catch (err) {
    console.error("createReview error:", err);
    return res.status(500).json({
      Message: "서버 에러",
      ResultCode: "ERR_SERVER",
      msg: err.message || err.toString(),
    });
  }
}

// 4. 리뷰(1개) 수정 -> jwt 필요
// PATCH /reviews/:facilityId/:reviewId
async function updateReview(req, res) {
  try {
    const userId = req.user.id; // jwt를 통해 user_id

    // 로그인 확인
    if (!userId) {
      return res.status(401).send({
        Message: "Unauthorized - 로그인 필요",
        ResultCode: "ERR_UNAUTHORIZED",
      });
    }

    // 경로 파라미터에서 id 가져오기
    const facilityId = parseInt(req.params.facilityId, 10);
    const reviewId = parseInt(req.params.reviewId, 10);
    let { content, rating, removeImages, finalOrder } = req.body; // 제목, 내용, 삭제할 이미지, 이미지 순서

    // 파라미터 확인
    if (isNaN(facilityId) || isNaN(reviewId)) {
      return res.status(400).json({
        Message: "Invalid parameters",
        ResultCode: "ERR_INVALID_PARAMS",
      });
    }

    // FormData 단일 값 보정 -> 배열 변환
    if (removeImages) {
      if (typeof removeImages === "string") removeImages = [removeImages];
      else if (!Array.isArray(removeImages)) removeImages = [];
    }
    if (finalOrder) {
      if (typeof finalOrder === "string") finalOrder = [finalOrder];
      else if (!Array.isArray(finalOrder)) finalOrder = [];
    }

    // 필수 항목 체크
    if (!content || rating == null) {
      return res.status(400).json({
        Message: "필수 항목(내용, 평점)이 없습니다",
        ResultCode: "ERR_EMPTY_CONTENT",
      });
    }
    // 평점 범위 체크
    if (rating < 1 || rating > 5) {
      return res.status(400).json({
        Message: "평점은 1~5 사이여야 합니다",
        ResultCode: "ERR_INVALID_RATING",
      });
    }

    // 수정할 글 조회
    const review = await models.review.findOne({
      where: {
        id: reviewId,
        status: { [Op.in]: ["ACTION", "REPORT_PENDING"] },
      },
    });
    if (!review) {
      return res.status(404).json({
        Message: "리뷰가 존재하지 않습니다.",
        ResultCode: "ERR_NOT_FOUND",
      });
    }

    // 작성자 확인
    if (review.user_id !== userId) {
      return res.status(403).json({
        Message: "Forbidden - 본인이 작성한 리뷰만 수정 가능합니다",
        ResultCode: "ERR_FORBIDDEN",
      });
    }

    // << 이미지 처리 >>
    let imageUrls = Array.isArray(review.images) ? [...review.images] : []; // 기존 이미지

    // 1. 삭제 처리
    if (Array.isArray(removeImages) && removeImages.length > 0) {
      imageUrls = imageUrls.filter((url) => !removeImages.includes(url));
    }

    // 2. 새로 업로드된 이미지 추가
    if (Array.isArray(req.files) && req.files.length > 0) {
      const uploadedUrls = req.files.map(
        (file) =>
          file.location ||
          `https://${process.env.AWS_BUCKET}.s3.amazonaws.com/${file.key}`
      );
      imageUrls = imageUrls.concat(uploadedUrls); // 기존 + 새 이미지 추가
    }

    // 3. 순서 변경 (클라이언트에서 최종 순서 배열 전달)
    // finalOrder = ["url3", "url1", "url2"] 같은 배열
    if (Array.isArray(finalOrder) && finalOrder.length > 0) {
      const unique = new Set(finalOrder); // 중복 이미지 X
      // finalOrder 기준으로 먼저 정렬 + 누락된 이미지들은 뒤에 붙이기
      imageUrls = [
        ...finalOrder.filter((url) => imageUrls.includes(url)),
        ...imageUrls.filter((url) => !unique.has(url)),
      ];
    }

    // DB 업데이트
    await review.update({
      content: content,
      rating: rating,
      images: imageUrls,
    });

    // 리뷰 통계 갱신
    try {
      await updateFacilityStats(review.facility_id);
    } catch(err) {
      console.error("Stats update failed:", err);
    }

    // DB 반영 후 최신 값 가져오기
    await review.reload();

    // 응답(Response) 보내기
    return res.status(200).json({
      Message: "게시글이 성공적으로 수정되었습니다.",
      ResultCode: "SUCCESS",
      Review: review.get({ plain: true }),
    });
  } catch (err) {
    console.error("updateReview error:", err);
    return res.status(500).json({
      Message: "Internal server error",
      ResultCode: "ERR_INTERNAL_SERVER",
      msg: err.message || err.toString(),
    });
  }
}

// 5. 리뷰 삭제하기
// DELETE /reviews/:facilityId/:reviewId
const s3 = new AWS.S3({
  region: process.env.AWS_S3_REGION,
  accessKeyId: process.env.AWS_S3_ACCESS_KEY,
  secretAccessKey: process.env.AWS_S3_SECRET_KEY,
});

async function deleteReview(req, res) {
  try {
    const userId = req.user.id; // jwt를 통해 user_id
    const facilityId = parseInt(req.params.facilityId, 10);
    const reviewId = parseInt(req.params.reviewId, 10);

    if (!userId) {
      // 로그인 확인
      return res.status(401).send({
        Message: "Unauthorized - 로그인 필요",
        ResultCode: "ERR_UNAUTHORIZED",
      });
    }

    // 파라미터 확인
    if (isNaN(facilityId) || isNaN(reviewId)) {
      return res.status(400).json({
        Message: "Invalid parameters",
        ResultCode: "ERR_INVALID_PARAMS",
      });
    }

    // 삭제할 리뷰 조회
    const review = await models.review.findOne({
      where: {
        id: reviewId,
        facility_id: facilityId,
        status: { [Op.in]: ["ACTION", "REPORT_PENDING"] },
      },
    });
    if (!review) {
      return res.status(404).json({
        Message: "삭제할 리뷰가 존재하지 않습니다.",
        ResultCode: "ERR_NOT_FOUND",
      });
    }

    // 작성자 확인
    if (review.user_id !== userId) {
      return res.status(403).json({
        Message: "Forbidden - 본인이 작성한 리뷰만 삭제할 수 있습니다.",
        ResultCode: "ERR_FORBIDDEN",
      });
    }

    // S3 이미지 삭제 (실패해도 무시)
    if (Array.isArray(review.images) && review.images.length > 0) {
      const deleteParams = {
        Bucket: process.env.AWS_BUCKET,
        Delete: {
          Objects: review.images.map((url) => ({
            Key: decodeURIComponent(new URL(url).pathname.slice(1)),
          })), 
        },
      };

      // 이미지 실패해도 리뷰는 삭제 처리 됨
      try {
        await s3.deleteObjects(deleteParams).promise();
        console.log("S3 이미지 삭제 완료");
      } catch (err) {
        console.error("S3 삭제 실패:", err);
      }
    }

    // 리뷰 삭제
    // Soft delete으로 함
    // 신고 내역/통계 페이지의 신고 횟수 때문에
    // 실제 삭제가 아니라 status: DELETED로 처리
    await review.update({ status: "DELETED", deleted_at: new Date() });

    // 리뷰 통계 갱신
    try {
      await updateFacilityStats(review.facility_id);
    } catch(err) {
      console.error("Stats update failed:", err);
    }

    // 응답 보내기
    return res.json({
      Message: "리뷰가 삭제되었습니다.",
      ResultCode: "OK",
      DeletedReviewId: reviewId,
    });
  } catch (err) {
    console.error("deleteReview error:", err);

    return res.status(500).json({
      Message: "Internal server error",
      ResultCode: "ERR_INTERNAL_SERVER",
      msg: err.toString(),
    });
  }
}

// 리뷰 신고하기
// /review/:reviewId/report
async function reportReview(req, res) {
  try {
    const userId = req.user.id; // JWT를 통해 user_id
    const reviewId = parseInt(req.params.reviewId, 10);
    const { category, reason } = req.body;

    // 1. 로그인 확인
    if (!userId) {
      return res.status(401).json({
        Message: "Unauthorized - 로그인 필요",
        ResultCode: "ERR_UNAUTHORIZED",
      });
    }

    // 2. 필수 파라미터 체크
    if (isNaN(reviewId) || !category) {
      return res.status(400).json({
        Message: "필수 항목이 누락되었습니다.",
        ResultCode: "ERR_BAD_REQUEST",
      });
    }

    // 3. category 체크
    const validCategories = [
      "DUPLICATE_SPAM",
      "AD_PROMOTION",
      "ABUSE_HATE",
      "PRIVACY_LEAK",
      "SEXUAL_CONTENT",
      "ETC",
    ];

    const upperCategory = category.toUpperCase(); // 대문자 처리하기
    if (!validCategories.includes(upperCategory)) {
      return res.status(400).json({
        Message: "Invalid category",
        ResultCode: "ERR_INVALID_CATEGORY",
      });
    }

    // 4. 리뷰 존재 여부 확인
    const review = await models.review.findOne({
      where: {
        id: reviewId,
        status: { [Op.in]: ["ACTION", "REPORT_PENDING"] },
      },
    });
    if (!review) {
      return res.status(404).json({
        Message: "신고 대상(리뷰)가 존재하지 않습니다.",
        ResultCode: "ERR_NOT_FOUND",
      });
    }

    // 5. 중복 신고 확인
    const existingReport = await models.report.findOne({
      where: {
        user_id: userId,
        type: "REVIEW",
        target_id: reviewId,
      },
    });
    if (existingReport) {
      return res.status(409).json({
        Message: "이미 신고한 리뷰입니다.",
        ResultCode: "ERR_DUPLICATE_REPORT",
      });
    }

    // 6. 신고 생성
    const report = await models.report.create({
      user_id: userId,
      type: "REVIEW",
      target_id: reviewId,
      category: upperCategory,
      reason,
    });

    // 7. 리뷰 상태 변경 (신고됨)
    await review.update({ status: "REPORT_PENDING" });

    // 8. 응답
    return res.status(201).json({
      Message: "리뷰 신고가 접수되었습니다.",
      ResultCode: "SUCCESS",
      Report: report.get({ plain: true }),
    });
  } catch (err) {
    console.error("reportReview error:", err);

    return res.status(500).json({
      Message: "Internal server error",
      ResultCode: "ERR_INTERNAL_SERVER",
      msg: err.toString(),
    });
  }
}

module.exports = {
  getReviews,
  getReview,
  createReview,
  updateReview,
  deleteReview,
  reportReview,
};
