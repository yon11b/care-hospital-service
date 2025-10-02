// 사용자 입장에서의 리뷰 api

const models = require('../../models');
const sha256 = require('sha256');
const app = require('../../app');
const Sequelize = require('sequelize');
const AWS = require('aws-sdk');
const { Op } = require('sequelize');


// 1. 리뷰 전체 리스트 조회
// 작성자, 작성일, 내용, 이미지, 평점, 방문인증
// GET /reviews/:facilityId
async function getReviews(req, res) {
  try {
    const facilityId = req.params.facilityId;
    const limit = parseInt(req.query.limit, 10) || 10;
    const cursor = req.query.cursor || null; // 무한 스크롤용 커서, 'created_at' 또는 'rating_createdAt' 형태
    const sort = req.query.sort || 'latest'; // latest(default) 또는 rating


    // 1. 파라미터 유효성 체크
    // limit 체크
    if (isNaN(limit) || limit <= 0 || limit > 50) {
    return res.status(400).json({
        Message: 'Invalid limit parameter',
        ResultCode: 'ERR_INVALID_PARAMETER',
    });
    }
    // sort 체크
    if (!['latest', 'rating'].includes(sort)) {
    return res.status(400).json({
        Message: 'Invalid sort parameter',
        ResultCode: 'ERR_INVALID_PARAMETER',
    });
    }
    // cursor 체크
    if (cursor && typeof cursor !== 'string') {
    return res.status(400).json({
        Message: 'Invalid cursor parameter',
        ResultCode: 'ERR_INVALID_PARAMETER',
    });
    }


    // 2. 기관 존재 여부 확인
    const facility = await models.facility.findByPk(facilityId);
    if (!facility) {
      return res.status(404).json({
        Message: 'Facility not found',
        ResultCode: 'ERR_NOT_FOUND',
      });
    }

    // 3. 기본 조회 조건
    const where = { 
      facility_id: facilityId, 
      status: {[Op.in]: ['ACTION', 'REPORT_PENDING']}  
    };
    let order; // 정렬 기준

    // 4. 정렬 기준에 따른 order와 cursor 처리
    if (sort === 'latest') { 
      // 최신순: created_at DESC
      order = [['created_at', 'DESC']]; 
      if (cursor) {
        where.created_at = { [Op.lt]: new Date(cursor) };
      }
    } else if (sort === 'rating') { 
        // 평점순: rating DESC, created_at DESC
        order = [
            ['rating', 'DESC'],
            ['created_at', 'DESC'],
        ];

        if (cursor) {
            try {
              // cursor = "평점_createdAt" 형태
              const [cursorRating, cursorDate] = cursor.split('_');
              if (isNaN(cursorRating) || !cursorDate) throw new Error('Invalid cursor format');

              // 평점이 낮거나, 평점이 같으면 created_at이 더 작은 글만 조회
              where[Op.or] = [
                { rating: { [Op.lt]: parseInt(cursorRating, 10) } },
                {
                    rating: parseInt(cursorRating, 10),
                    created_at: { [Op.lt]: new Date(cursorDate) },
                },
              ];
            }catch (e) {
                return res.status(400).json({
                    Message: 'Invalid cursor format',
                    ResultCode: 'ERR_INVALID_PARAMETER',
                });
          }
        }
    }

    // 5. 리뷰 조회
    const review = await models.review.findAll({
      where, // 필터 조건 (해당 기관, action, report_pending 리뷰들.)
      order, // 정렬
      limit, // 한번에 가져올 개수
      attributes: ['id', 'user_id', 'content', 'images', 'rating', 'visited', 'created_at'],
      include: [{ 
        model: models.user,  // 작성자 
        attributes: ['id', 'name'] 
      }], 
    });

    // 6. 다음 cursor 계산
    let nextCursor = null;
    if (Array.isArray(review) && review.length > 0) {
      const last = review[review.length - 1]; // 마지막 리뷰 기준

      if (last && last.created_at) {
        if (sort === 'latest') { // 최신순: 마지막 created_at
          nextCursor = last.created_at.toISOString(); 
        } 
        else if (sort === 'rating') { // 평점순 중 created_at 비교
          nextCursor = `${last.rating}_${last.created_at.toISOString()}`;
        }
      }
    }

    // 7.응답 반환
    res.status(200).json({
      Message: 'Success',
      ResultCode: 'OK',
      Reviews: review.map(r => r.get({ plain: true })),
      nextCursor, // 다음 페이지 커서
    });
  } catch (err) {
    console.log(err);
    res.status(400).send({
      Message: 'Invalid parameter - 잘못된 쿼리',
      ResultCode: 'ERR_INVALID_PARAMETER',
      Error: err.toString(),
    });
  }
}

// 2. 리뷰 한개 상세 조회
// GET /reviews/:facilityId/:reviewId -> getReview, 
async function getReview(req, res) {
  try{
    // 경로 파라미터에서 id 가져오기
    const facilityId = parseInt(req.params.facilityId, 10);
    const reviewId= parseInt(req.params.reviewId, 10);

    // 파라미터 확인
    if (isNaN(facilityId) || isNaN(reviewId)) {
      return res.status(400).json({
        Message: "Invalid parameters",
        ResultCode: "ERR_INVALID_PARAMS",
      });
    }

    // 리뷰 조회 (작성자 정보 포함)
    const review = await models.review.findOne({
      where: { 
        id: reviewId, 
        facility_id: facilityId, 
        status: {[Op.in]: ['ACTION', 'REPORT_PENDING']}  
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
        Message: 'Success',
        ResultCode: 'OK',
        Review: review.get({ plain: true }),
    });


  } catch (err){
    //bad request
    console.error("getReview error:", err);
    res.status(500).json({
        Message : '서버 에러',
        ResultCode : 'ERR_SERVER',
        Error: err.toString(),
    });
  }
}


// 3. 리뷰 생성  -> jwt 필요
// POST /reviews/:facilityId -> createReview,
// 사용자의 user_id -> jwt 토큰을 통해..
async function createReview(req, res){
  try{
    const userId = req.user.id; 
    const facilityId = parseInt(req.params.facilityId, 10);
    const { content, rating , reservationId} = req.body;


    // 로그인 확인
    if(!userId){
        return res.status(401).send({
        Message: 'Unauthorized - 로그인 필요',
        ResultCode: 'ERR_UNAUTHORIZED',
      });
    }

    if (isNaN(facilityId)) {
        return res.status(400).json({
            Message: "Invalid facility ID",
            ResultCode: "ERR_INVALID_ID"
        });
    }

    // 필수 확인
    if(!content ||  rating == null) {
      return res.status(400).json({
        Message: "필수 항목이 누락되었습니다.",
        ResultCode: 'ERR_BAD_REQUEST',
      });
    }

    // 평점 범위 확인
    if (rating < 1 || rating > 5) {
      return res.status(400).json({
        Message: 'Invalid rating',
        ResultCode: 'ERR_INVALID_RATING',
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
          user_id: userId, 
          facility_id: facilityId,
          status :  'CONFIRMED',
        },
      });

      if (reservation  && reservation.reservation_time) {
        visited = new Date(reservation.reservation_time) < new Date();
      }
    }    
      
    // 업로드된 파일들에서 s3 url 뽑기
    // req.files 는 배열 형태 (upload.array)
    const imageUrls = Array.isArray(req.files) ? req.files.map(file => file.location) : [];

    // db 저장
    const review = await models.review.create({
      user_id: userId,
      facility_id: facilityId,
      content,
      rating,
      images: imageUrls,
      visited,
      reply: null, // 관리자 답변은 아직 없음
    });

    return res.status(201).json({
      Message: "리뷰가 성공적으로 등록되었습니다.",
      ResultCode : "SUCCESS",
      Review : review.get({ plain: true }),
    });

  } catch(err) {
    console.error('createReview error:', err);
    return res.status(500).json({ 
      Message: '서버 에러', 
      ResultCode: 'ERR_SERVER',
      msg: err.message || err.toString(), 
    });
  }
}


// 4. 리뷰(1개) 수정 -> jwt 필요
// PATCH /reviews/:facilityId/:reviewId
async function updateReview(req, res) {
  try{
    const userId = req.user.id; // jwt를 통해 user_id

    // 로그인 확인
    if(!userId){
        return res.status(401).send({
        Message: 'Unauthorized - 로그인 필요',
        ResultCode: 'ERR_UNAUTHORIZED',
      });
    }

    // 경로 파라미터에서 id 가져오기
    const facilityId = parseInt(req.params.facilityId, 10);
    const reviewId= parseInt(req.params.reviewId, 10);
    const { content, rating, removeImages, finalOrder } = req.body; // 제목, 내용, 삭제할 이미지, 이미지 순서
    
    // 파라미터 확인
    if (isNaN(facilityId) || isNaN(reviewId)) {
      return res.status(400).json({
        Message: "Invalid parameters",
        ResultCode: "ERR_INVALID_PARAMS",
      });
    }

    // FormData 단일 값 보정 -> 배열 변환
    if (typeof removeImages === 'string') removeImages = [removeImages];
    if (typeof finalOrder === 'string') finalOrder = [finalOrder];

    // 필수 항목 체크
    if (!content || rating == null) {
        return res.status(400).json({
            Message: "필수 항목(내용, 평점)이 없습니다",
            ResultCode: "ERR_EMPTY_CONTENT"
        });
    }
    // 평점 범위 체크
    if (rating < 1 || rating > 5) {
        return res.status(400).json({
            Message: "평점은 1~5 사이여야 합니다",
            ResultCode: "ERR_INVALID_RATING"
        });
    }   

    // 수정할 글 조회
    const review = await models.review.findOne({ 
      where: { 
        id: reviewId ,
        status: {[Op.in]: ['ACTION', 'REPORT_PENDING']}
      } 
    });
    if (!review ) {
      return res.status(404).json({
        Message: '리뷰가 존재하지 않습니다.',
        ResultCode: 'ERR_NOT_FOUND',
      });
    } 

    // 작성자 확인
    if (review.user_id !== userId) {
      return res.status(403).json({
        Message: 'Forbidden - 본인이 작성한 리뷰만 수정 가능합니다',
        ResultCode: 'ERR_FORBIDDEN',
      });
    }


    // << 이미지 처리 >> 
    let imageUrls = Array.isArray(review.images) ? [...review.images] : []; // 기존 이미지

    // 1. 삭제 처리
    if (Array.isArray(removeImages) && removeImages.length > 0) {
      imageUrls = imageUrls.filter(url => !removeImages.includes(url));
    }

    // 2. 새로 업로드된 이미지 추가
    if (Array.isArray(req.files) && req.files.length > 0) {
      const uploadedUrls = req.files.map(
        file => file.location || `https://${process.env.AWS_BUCKET}.s3.amazonaws.com/${file.key}`
      );
      imageUrls = imageUrls.concat(uploadedUrls); // 기존 + 새 이미지 추가
    }

    // 3. 순서 변경 (클라이언트에서 최종 순서 배열 전달)
    // finalOrder = ["url3", "url1", "url2"] 같은 배열
    if (Array.isArray(finalOrder) && finalOrder.length > 0) {
      const unique = new Set(finalOrder); // 중복 이미지 X
      // finalOrder 기준으로 먼저 정렬 + 누락된 이미지들은 뒤에 붙이기
      imageUrls = [
        ...finalOrder.filter(url => imageUrls.includes(url)),
        ...imageUrls.filter(url => !unique.has(url))];
    }

    // DB 업데이트
    await review.update({
      content: content,
      rating: rating,
      images: imageUrls,
    });

    // DB 반영 후 최신 값 가져오기
    await review.reload();

    // 응답(Response) 보내기
    return res.status(200).json({
      Message: '게시글이 성공적으로 수정되었습니다.',
      ResultCode: 'SUCCESS',
      Review : review.get({ plain: true }),
    });

  }catch(err){
    console.error('updateReview error:', err);
    return res.status(500).json({
      Message: 'Internal server error',
      ResultCode: 'ERR_INTERNAL_SERVER',
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
  try{
    const userId = req.user.id; // jwt를 통해 user_id
    const facilityId = parseInt(req.params.facilityId, 10);
    const reviewId= parseInt(req.params.reviewId, 10);

    if(!userId){ // 로그인 확인
        return res.status(401).send({
        Message: 'Unauthorized - 로그인 필요',
        ResultCode: 'ERR_UNAUTHORIZED',
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
        id: reviewId ,
        facility_id: facilityId, 
        status: {[Op.in]: ['ACTION', 'REPORT_PENDING']}
      } 
    });
    if (!review) {
      return res.status(404).json({
        Message: '삭제할 리뷰가 존재하지 않습니다.',
        ResultCode: 'ERR_NOT_FOUND',
      });
    } 

    // 작성자 확인
    if (review.user_id !== userId) {
      return res.status(403).json({
        Message: 'Forbidden - 본인이 작성한 리뷰만 삭제할 수 있습니다.',
        ResultCode: 'ERR_FORBIDDEN',
      });
    }

    
    // S3 이미지 삭제 (실패해도 무시)
    if (Array.isArray(review.images) && review.images.length > 0) {
        const deleteParams = {
          Bucket: process.env.AWS_BUCKET,
          Delete: {
            Objects: review.images.map(url => ({ 
              Key: decodeURIComponent(new URL(url).pathname.slice(1)) })), // 가능하면 Key를 DB에 저장
          },
        };

      // 이미지 실패해도 리뷰는 삭제 처리 됨
      try {
        await s3.deleteObjects(deleteParams).promise();
        console.log('S3 이미지 삭제 완료');
      } catch (err) {
        console.error('S3 삭제 실패:', err);
      }
    }

    // 리뷰 삭제 
    // Soft delete으로 함
    // 신고 내역/통계 페이지의 신고 횟수 때문에 
    // 실제 삭제가 아니라 status: DELETED로 처리
    await review.update(
      { status: 'DELETED', deleted_at: new Date() }, 
    );
    
    // 응답 보내기
    return res.json({
      Message: '리뷰가 삭제되었습니다.',
      ResultCode: 'OK',
      DeletedReviewId : reviewId
    });

  }catch(err){
    console.error('deleteReview error:', err);

    return res.status(500).json({
      Message: 'Internal server error',
      ResultCode: 'ERR_INTERNAL_SERVER',
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
    reportReview
};