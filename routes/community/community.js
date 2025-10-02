// 사용자 입장에서의 게시글 api

const models = require('../../models');
const sha256 = require('sha256');
const app = require('../../app');
const Sequelize = require('sequelize');
const AWS = require('aws-sdk');
const { Op } = require('sequelize');

// 1. 커뮤니티 전체 리스트 조회 
// 제목, 작성자, 작성일, 댓글수, 이미지, 내용물(3줄정도)
// GET /community
async function getCommunities(req, res) {
  try{
    const limit = parseInt(req.query.limit, 10) || 10;  // 한 번에 가져올 개수 : 기본 10개
    const lastId = req.query.lastId || null ; // 마지막으로 가져온 글 id

    const where = {
      status: {[Op.in]: ['ACTION', 'REPORT_PENDING']}, // 게시글 상태가 ACTION인 것만
    };

    if (lastId) {
      where.id = { [Sequelize.Op.lt]: lastId }; // 마지막 글보다 작은 id만 가져오기
    }

    const communities = await models.community.findAll({
      where,
      attributes: [
        'id', 'title', 'createdAt', 'content', 'images', 

        // 총 댓글수
        [Sequelize.literal(`(
            SELECT COUNT(*)
            FROM "comments" AS c
            WHERE c.community_id = "community"."id"
            AND c.status IN ('ACTION', 'REPORT_PENDING')
        )`), 'totalComments']
      ],
      include: [
        { // 작성자 정보 (이름)
          model: models.user,         
          attributes: ['id', 'name']        
        },
      ],
      order: [['createdAt', 'DESC']], // 최신 글 먼저
      limit,
    });

    // 응답(Response) 보내기
    res.status(200).json({
        Message: 'Success',
        ResultCode: 'OK',
        Community: communities, // resp가 []이면 게시글 없음
    });

  } catch(err){
    //bad request
    console.log(err);
    res.status(400).send({
        Message : 'Invalid parameter - 잘못된 쿼리',
        ResultCode : 'ERR_INVALID_PARAMETER',
        Error: err.toString(),
    });
  }
}

// 2. 커뮤니티 특정 글(1개) 선택하고 보기(조회)
// GET /community/:communityId
async function getCommunity(req, res) {
  try {
    const communityId = parseInt(req.params.communityId, 10);
    if (isNaN(communityId)) {
      return res.status(400).json({
        Message: 'Invalid parameter - 잘못된 쿼리',
        ResultCode: 'ERR_INVALID_PARAMETER',
      });
    }

    // 1. 커뮤니티 글 조회
    const community = await models.community.findOne({
      where: { id: communityId, status: { [Op.in]: ['ACTION', 'REPORT_PENDING'] } },
      attributes: ['id', 'title', 'content', 'images', 'created_at'],
      include: [{ model: models.user, attributes: ['id', 'name'] }],
    });

    if (!community) {
      return res.status(404).json({
        Message: '게시글이 존재하지 않습니다.',
        ResultCode: 'ERR_NOT_FOUND',
      });
    }

    // 2. 루트 댓글 + 모든 하위 댓글(root_parent_id 기준) 조회
    const comments = await models.comment.findAll({
      where: {
        community_id: communityId,
        status: { [Op.in]: ['ACTION', 'REPORT_PENDING'] }
      },
      order: [['created_at', 'ASC']],
      include: [{ model: models.user, attributes: ['id', 'name'] }],
    });

    // 3. 루트 댓글과 하위 댓글 그룹핑
    const rootComments = comments.filter(c => c.parent_id === null);
    const replies = comments.filter(c => c.parent_id !== null);

    const commentsTree = rootComments.map(root => {
      const children = replies
        .filter(r => r.root_parent_id === root.id)
        .map(r => ({
          commentId: r.id,
          content: r.content,
          parentId: r.parent_id,
          rootParentId: r.root_parent_id,
          userId: r.user_id,
          userName: r.user?.name || null, // 멘션 대상자
          createdAt: r.created_at,
        }));

      return {
        commentId: root.id,
        content: root.content,
        userId: root.user_id,
        userName: root.user?.name || null,
        createdAt: root.created_at,
        replies: children, // 모든 하위 댓글 포함
      };
    });

    // 4. 응답
    return res.status(200).json({
      Message: 'Success',
      ResultCode: 'OK',
      Community: {
        id: community.id,
        title: community.title,
        content: community.content,
        images: community.images,
        createdAt: community.created_at,
        user: { id: community.user.id, name: community.user.name },
        comments: commentsTree,
      },
    });

  } catch (err) {
    console.error('getCommunity error:', err);
    return res.status(500).json({
      Message: 'Internal server error',
      ResultCode: 'ERR_INTERNAL_SERVER',
      Error: err.toString(),
    });
  }
}


// 3. 커뮤니티 특정 글(1개) 생성 -> jwt 필요
// POST /community 
// 사용자의 user_id -> jwt 토큰을 통해..
async function createCommunity(req, res){
  try{
    const userId = req.user?.id; 
    const { title, content } = req.body;

    // 로그인 확인
    if(!userId){
        return res.status(401).send({
        Message: 'Unauthorized - 로그인 필요',
        ResultCode: 'ERR_UNAUTHORIZED',
      });
    }

    // 필수 확인
    if(!title || !content) {
      return res.status(400).json({
        message: "제목과 내용을 입력해주세요.",
        ResultCode: 'ERR_BAD_REQUEST',
      });
    }

    // 업로드된 파일들에서 s3 url 뽑기
    // req.files 는 배열 형태 (upload.array)
    const imageUrls = Array.isArray(req.files) ? req.files.map(file => file.location) : [];

    // db 저장
    const community = await models.community.create({
      user_id : userId,
      title,
      content,
      images: imageUrls, // JSONB 배열 컬럼
    });

    return res.status(201).json({
      Message: "게시글이 성공적으로 등록되었습니다.",
      ResultCode : "SUCCESS",
      Community: community,
    });

  } catch(err) {
    console.error('createCommunity error:', err);
    return res.status(500).json({ 
      Message: '서버 에러', 
      ResultCode: 'ERR_SERVER',
      msg: err.message || err.toString(), 
    });
  }
}

// 4. 커뮤니티 특정 글(1개) 수정 -> jwt 필요
// PATCH /community/:communityId 
async function updateCommunity(req, res) {
  try{
    const userId = req.user?.id; // jwt를 통해 user_id
    
    // 로그인 확인
    if(!userId){
        return res.status(401).send({
        Message: 'Unauthorized - 로그인 필요',
        ResultCode: 'ERR_UNAUTHORIZED',
      });
    }

    const communityId = parseInt(req.params.communityId, 10); // 경로에서 커뮤니티 글 id
    let{ title, content, removeImages, finalOrder} = req.body;

    if (isNaN(communityId)) {
      return res.status(400).json({
        Message: 'Invalid parameter - 잘못된 쿼리',
        ResultCode: 'ERR_INVALID_PARAMETER',
      });
    }

    // 단일 값이 들어올 경우 배열로 통일
    if (typeof removeImages === 'string') removeImages = [removeImages];
    if (typeof finalOrder === 'string') finalOrder = [finalOrder];

    // 수정할 글 조회 (ACTION, REPORT_PENDING만 가능)
    const community = await models.community.findOne({ 
      where: { 
        id: communityId,
        status: {[Op.in]: ['ACTION', 'REPORT_PENDING']}
      } 
    });
    if (!community) {
      return res.status(404).json({
        Message: '게시글이 존재하지 않습니다.',
        ResultCode: 'ERR_NOT_FOUND',
      });
    } 

    // 작성자 확인
    if (community.user_id !== userId) {
      return res.status(403).json({
        Message: 'Forbidden - 본인이 작성한 글만 수정 가능합니다',
        ResultCode: 'ERR_FORBIDDEN',
      });
    }

    // << 이미지 처리 >> 
    let imageUrls = Array.isArray(community.images) ? [...community.images] : []; // 기존 이미지

    // 1. 삭제 처리
    if (Array.isArray(removeImages) && removeImages.length > 0) {
      imageUrls = imageUrls.filter(url => !removeImages.includes(url));
    }

    // 2. 새로 업로드된 이미지 추가
    if (Array.isArray(req.files) && req.files.length > 0) {
      const uploadedUrls = req.files.map(
        file => file.location || `https://${process.env.AWS_BUCKET}.s3.amazonaws.com/${file.key}`
      );
      imageUrls = [...imageUrls, ...uploadedUrls]; // 기존 + 새 이미지 추가
    }

    // 3. 순서 변경 (클라이언트에서 최종 순서 배열 전달)
    // finalOrder = ["url3", "url1", "url2"] 같은 배열
    if (Array.isArray(finalOrder) && finalOrder.length > 0) {
      const unique = new Set(finalOrder); // 중복 이미지 X
      // finalOrder 기준으로 먼저 정렬 + 누락된 이미지들은 뒤에 붙이기
      imageUrls = [
        ...finalOrder.filter(url => imageUrls.includes(url)),
        ...imageUrls.filter(url => !unique.has(url))
      ];
    }

    // DB 업데이트
    await community.update({
      title: title || community.title,
      content: content || community.content,
      images: imageUrls,
    });

    // DB 반영 후 최신 값 가져오기
    await community.reload();

    // 응답(Response) 보내기
    return res.status(200).json({
      Message: '게시글이 성공적으로 수정되었습니다.',
      ResultCode: 'SUCCESS',
      Community: community,
    });

  }catch(err){
    console.error('updateCommunity error:', err);
    return res.status(500).json({
      Message: 'Internal server error',
      ResultCode: 'ERR_INTERNAL_SERVER',
      msg: err.message || err.toString(),
    });
  }
}

// 5. 커뮤니티 특정 글(1개) 삭제 -> jwt 필요
// DELETE /community/:communityId
const s3 = new AWS.S3({
  region: process.env.AWS_S3_REGION,
  accessKeyId: process.env.AWS_S3_ACCESS_KEY,
  secretAccessKey: process.env.AWS_S3_SECRET_KEY,
});
        
async function deleteCommunity(req, res) {

  try{
    const userId = req.user.id; // jwt를 통해 user_id
    const communityId = parseInt(req.params.communityId, 10); // 경로에서 커뮤니티 글 id

    if(!userId){ // 로그인 확인
        return res.status(401).send({
        Message: 'Unauthorized - 로그인 필요',
        ResultCode: 'ERR_UNAUTHORIZED',
      });
    }
    // 파라미터 확인
    if (isNaN(communityId)) {
      return res.status(400).json({
        Message: 'Invalid parameter - 잘못된 쿼리',
        ResultCode: 'ERR_INVALID_PARAMETER',
      });
    }
    // 삭제할 글 조회
    const community = await models.community.findOne({ 
      where: { 
        id: communityId, 
        status: { [Op.in]: ['ACTION', 'REPORT_PENDING'] }
      },
    });
    if (!community) {
      return res.status(404).json({
        Message: '삭제할 게시글이 존재하지 않습니다.',
        ResultCode: 'ERR_NOT_FOUND',
      });
    } 

    // 작성자 확인
    if (community.user_id !== userId) {
      return res.status(403).json({
        Message: 'Forbidden - 본인이 작성한 글만 삭제할 수 있습니다.',
        ResultCode: 'ERR_FORBIDDEN',
      });
    }

    
    // S3 이미지 삭제 (실패해도 롤백하지 않음)
    if (Array.isArray(community.images) && community.images.length > 0) {
        const deleteParams = {
          Bucket: process.env.AWS_BUCKET,
          Delete: {
            Objects: community.images.map(url => ({ 
              Key: decodeURIComponent(new URL(url).pathname.slice(1)) })), // 가능하면 Key를 DB에 저장
          },
        };

      // 이미지 실패해도 게시글은 삭제 처리 됨
      try { 
        await s3.deleteObjects(deleteParams).promise();
        console.log('S3 이미지 삭제 완료');
      } catch (err) {
        console.error('S3 삭제 실패:', err);
      }
    }

    // 소프트 삭제 처리 : 커뮤니티 글
    await community.update(
      { status: 'DELETED', deleted_at: new Date() },
    );

    // 소프트 삭제 처리: 삭제 글의 댓글 + 대댓글 모두
    await models.comment.update(
      { status: 'DELETED', deleted_at: new Date() },
      { where: { community_id: communityId, status: { [Op.in]: ['ACTION', 'REPORT_PENDING'] } } }
    );

    return res.json({
      Message: '게시글이 삭제되었습니다.',
      ResultCode: 'OK',
      DeletedCommunityId : communityId
    });

  }catch(err){
    console.error('deleteCommunity error:', err);

    return res.status(500).json({
      Message: 'Internal server error',
      ResultCode: 'ERR_INTERNAL_SERVER',
      msg: err.toString(),
    });
  }
}

// 댓글 / 대댓글 작성
// POST /community/:communityId/comment
async function createComment(req, res) {
  try {
    const userId = req.user.id; // JWT에서 추출
    const { communityId } = req.params;
    const { content, parent_id } = req.body;

    // 1. 로그인 확인
    if (!userId) {
      return res.status(401).json({
        Message: 'Unauthorized - 로그인 필요',
        ResultCode: 'ERR_UNAUTHORIZED',
      });
    }

    // 2. 필수 파라미터 체크
    if (!content) {
      return res.status(400).json({
        Message: '댓글 내용을 입력해주세요.',
        ResultCode: 'ERR_BAD_REQUEST',
      });
    }

    // 3. 커뮤니티 글 존재 여부 확인
    const community = await models.community.findOne({
      where: { 
        id: communityId, 
        status: { [Op.in]: ['ACTION', 'REPORT_PENDING'] } 
      }
    });
    if (!community) {
      return res.status(404).json({
        Message: '댓글 작성 대상 커뮤니티 글이 존재하지 않습니다.',
        ResultCode: 'ERR_NOT_FOUND',
      });
    }

    let parentIdNum = null;
    let rootParentId = null;

    // 4. parent_id 처리 (대댓글 여부)
    if (parent_id != null) {
      parentIdNum = parseInt(parent_id, 10);
      if (isNaN(parentIdNum)) {
        return res.status(400).json({
          Message: 'Invalid parent_id',
          ResultCode: 'ERR_INVALID_PARAMETER'
        });
      }

      // 부모 댓글 조회
      const parentComment = await models.comment.findOne({
          where: { 
            id: parentIdNum, 
            community_id: communityId, 
            status: { [Op.in]: ['ACTION', 'REPORT_PENDING'] } 
          },
          attributes: ['id', 'root_parent_id']
      });

      if (!parentComment) {
        return res.status(404).json({
          Message: '존재하지 않거나 삭제된 부모 댓글입니다.',
          ResultCode: 'ERR_PARENT_NOT_FOUND',
        });
      }

      // 루트 부모 ID 결정
      rootParentId = parentComment.root_parent_id || parentComment.id;
    }

    // 5. 댓글 생성
    const comment = await models.comment.create({
      user_id: userId,
      community_id: communityId,
      content,
      parent_id: parentIdNum,
      root_parent_id: rootParentId,
    });

    // 6. 작성자 이름 조회
    const user = await models.user.findOne({
      where: { id: userId },
      attributes: ['name']
    });

    // 7. 응답
    return res.status(201).json({
      Message: "Comment created successfully",
      ResultCode: "OK",
      comment: {
        commentId: comment.id,
        communityId: comment.community_id,
        userId: comment.user_id,
        userName: user ? user.name : null,
        content: comment.content,
        parentId: comment.parent_id,
        rootParentId: comment.root_parent_id,
        createdAt: comment.createdAt,
      }
    });

  } catch (err) {
    console.error('createComment error:', err);
    return res.status(500).json({
      Message: 'Internal server error',
      ResultCode: 'ERR_INTERNAL_SERVER',
      msg: err.toString(),
    });
  }
}

// 댓글 / 대댓글 수정
// PATCH /community/:communityId/comment/:commentId
async function updateComment(req, res) {
  try {
    const userId = req.user.id; // JWT에서 추출
    const { communityId, commentId } = req.params;
    const { content } = req.body;

    // 1. 로그인 확인
    if (!userId) {
      return res.status(401).json({
        Message: 'Unauthorized - 로그인 필요',
        ResultCode: 'ERR_UNAUTHORIZED',
      });
    }

    // 2. 필수 파라미터 체크
    if (!content) {
      return res.status(400).json({
        Message: '수정할 댓글 내용을 입력해주세요.',
        ResultCode: 'ERR_BAD_REQUEST',
      });
    }

    // 3. 댓글 존재 여부 확인 (삭제된 글이나 다른 글의 댓글 방지)
    const comment = await models.comment.findOne({
      where: { 
        id: commentId, 
        community_id: communityId, 
        status: {[Op.in]: ['ACTION', 'REPORT_PENDING']}
      },
    });

    if (!comment) {
      return res.status(404).json({
        Message: '수정할 댓글이 존재하지 않습니다.',
        ResultCode: 'ERR_NOT_FOUND',
      });
    }

    // 4. 작성자 확인
    if (comment.user_id !== userId) {
      return res.status(403).json({
        Message: 'Forbidden - 본인이 작성한 댓글만 수정 가능합니다.',
        ResultCode: 'ERR_FORBIDDEN',
      });
    }

    // 5. 댓글 수정
    await comment.update({ content });

    // 6. 작성자 이름 조회
    const user = await models.user.findOne({
      where: { id: userId },
      attributes: ['name'],
    });

    // 7. 응답
    return res.status(200).json({
      Message: 'Comment updated successfully',
      ResultCode: 'OK',
      comment: {
        commentId: comment.id,
        postId: comment.community_id,
        parentId: comment.parent_id,  // 대댓글이면 parent_id 있음
        userId: comment.user_id,
        userName: user ? user.name : null,
        content: comment.content,
        updatedAt: comment.updatedAt,
      },
    });
  } catch (err) {
    console.error('updateComment error:', err);
    return res.status(500).json({
      Message: 'Internal server error',
      ResultCode: 'ERR_INTERNAL_SERVER',
      msg: err.toString(),
    });
  }
}

// 댓글 / 대댓글 삭제 (모든 하위 댓글 포함, status = DELETED)
async function deleteComment(req, res) {
  try {
    const userId = req.user.id;
    const { communityId, commentId } = req.params;

    if (!userId) {
      return res.status(401).json({ 
        Message: 'Unauthorized - 로그인 필요', 
        ResultCode: 'ERR_UNAUTHORIZED' 
      });
    }

    // 1. 삭제할 댓글 조회
    const comment = await models.comment.findOne({
      where: { 
        id: commentId, 
        community_id: communityId, 
        status: { [Op.in]: ['ACTION', 'REPORT_PENDING'] } 
      }
    });

    if (!comment) {
      return res.status(404).json({ 
        Message: '삭제할 댓글이 존재하지 않습니다.', 
        ResultCode: 'ERR_NOT_FOUND' 
      });
    }

    // 2. 작성자 확인
    if (comment.user_id !== userId) {
      return res.status(403).json({ 
        Message: '본인이 작성한 댓글만 삭제 가능합니다.', 
        ResultCode: 'ERR_FORBIDDEN' 
      });
    }

    const now = new Date();

    // 3. 재귀적으로 하위 댓글 ID 모두 찾기
    const allIds = [comment.id]; // 삭제 대상 ID 배열

    async function collectChildComments(parentIds) {
      if (!parentIds.length) return;
      const childComments = await models.comment.findAll({
        where: {
          parent_id: { [Op.in]: parentIds },
          status: { [Op.in]: ['ACTION', 'REPORT_PENDING'] }
        },
        attributes: ['id'],
        raw: true
      });

      if (childComments.length) {
        const childIds = childComments.map(c => c.id);
        allIds.push(...childIds);
        await collectChildComments(childIds); // 재귀 호출
      }
    }

    await collectChildComments([comment.id]);

    // 4. soft delete 처리
    await models.comment.update(
      { status: 'DELETED', deleted_at: now },
      { where: { id: allIds } }
    );

    // 5. 응답
    return res.status(200).json({
      Message: 'Comment and all child comments deleted successfully',
      ResultCode: 'OK',
      DeletedCommentIds: allIds,
    });

  } catch (err) {
    console.error('deleteComment error:', err);
    return res.status(500).json({
      Message: 'Internal server error',
      ResultCode: 'ERR_INTERNAL_SERVER',
      msg: err.toString(),
    });
  }
}

// ======================
// 신고 기능 (커뮤니티, 댓글)
// ======================

// 커뮤니티 신고하기
// /community/{communityId}/report
async function reportCommunity(req, res) {
  try{
    const userId = req.user?.id; // JWT를 통해 user_id    
    const communityId = parseInt(req.params.communityId, 10); // 경로에서 커뮤니티 글 id
    const { category, reason } = req.body;
    
    // 1. 로그인 확인
    if(!userId){
      return res.status(401).json({
        Message: 'Unauthorized - 로그인 필요',
        ResultCode: 'ERR_UNAUTHORIZED',
      });
    }

    // 2. 필수 파라미터 체크
    if (isNaN(communityId) || !category) {
      return res.status(400).json({
        Message: '필수 항목이 누락되었습니다.',
        ResultCode: 'ERR_BAD_REQUEST',
      });
    }

    // 3. category 체크
    const validCategories = [
      'DUPLICATE_SPAM',
      'AD_PROMOTION',
      'ABUSE_HATE',
      'PRIVACY_LEAK',
      'SEXUAL_CONTENT',
      'ETC'
    ];

    const upperCategory = category.toUpperCase(); // 대문자 처리하기
    if (!validCategories.includes(upperCategory)) {
      return res.status(400).json({
        Message: 'Invalid category',
        ResultCode: 'ERR_INVALID_CATEGORY',
      });
    }

    // 4. 커뮤니티 글 존재 여부 확인
    const community = await models.community.findOne({
      where: { 
        id: communityId, 
        status: { [Op.in]: ['ACTION', 'REPORT_PENDING'] } 
      } 
    });
    if (!community) {
      return res.status(404).json({
        Message: '신고 대상(커뮤니티)가 존재하지 않습니다.',
        ResultCode: 'ERR_NOT_FOUND',
      });
    }

    // 5. 중복 신고 확인
    const existingReport = await models.report.findOne({
      where: { 
        user_id: userId, 
        type: 'COMMUNITY', 
        target_id: communityId }
    });
    if (existingReport) {
      return res.status(409).json({
        Message: '이미 신고한 커뮤니티 글 입니다.',
        ResultCode: 'ERR_DUPLICATE_REPORT',
      });
    }

      // 6. 신고 생성
    const  report = await models.report.create({
        user_id: userId,
        type: 'COMMUNITY',
        target_id: communityId,
        category : upperCategory,
        reason,
      }
    );

    // 7. 커뮤니티 상태 변경 (신고됨) -> 댓글/대댓글은 그대로 둠
    await community.update({ status: 'REPORT_PENDING' });

    // 8. 응답
    return res.status(201).json({      
      Message: '커뮤니티 글 신고가 접수되었습니다.',
      ResultCode: 'SUCCESS',
      Report: report.get({ plain: true })
    });

  }catch(err){
    console.error('reportCommunity error:', err);

    return res.status(500).json({
      Message: 'Internal server error',
      ResultCode: 'ERR_INTERNAL_SERVER',
      msg: err.toString(),
    });
  }
}


// 댓글 신고하기
// POST /community/:communityId/comment/:commentId/report
async function reportComment(req, res) {
  try {
    const userId = req.user.id; // JWT에서 추출
    const { communityId, commentId } = req.params;
    const { category, reason } = req.body;

    // 1. 로그인 확인
    if (!userId) {
      return res.status(401).json({
        Message: 'Unauthorized - 로그인 필요',
        ResultCode: 'ERR_UNAUTHORIZED',
      });
    }

    // 2. 필수 파라미터 체크
    if (!communityId || !commentId || !category) {
      return res.status(400).json({
        Message: '필수 항목이 누락되었습니다.',
        ResultCode: 'ERR_BAD_REQUEST',
      });
    }

    // 3. category 체크
    const validCategories = [
      'DUPLICATE_SPAM',
      'AD_PROMOTION',
      'ABUSE_HATE',
      'PRIVACY_LEAK',
      'SEXUAL_CONTENT',
      'ETC'
    ];

    const upperCategory = category.toUpperCase(); // 대문자 처리하기
    if (!validCategories.includes(upperCategory)) {
      return res.status(400).json({
        Message: 'Invalid category',
        ResultCode: 'ERR_INVALID_CATEGORY',
      });
    }

    // 4. 커뮤니티 존재 여부 확인
    const community = await models.community.findOne({
      where: { 
        id: communityId, 
        status: {[Op.in]: ['ACTION', 'REPORT_PENDING']} 
      }
    });
    if (!community) {
      return res.status(404).json({
        Message: '신고 대상 커뮤니티 글이 존재하지 않습니다.',
        ResultCode: 'ERR_NOT_FOUND',
      });
    }

    // 5. 댓글 존재 여부 확인
    const comment = await models.comment.findOne({
      where: { 
        id: commentId, 
        community_id: communityId, 
        status: {[Op.in]: ['ACTION', 'REPORT_PENDING']}
      }
    });
    if (!comment) {
      return res.status(404).json({
        Message: '신고 대상 댓글이 존재하지 않습니다.',
        ResultCode: 'ERR_NOT_FOUND',
      });
    }

    // 6. 중복 신고 확인
    const existingReport = await models.report.findOne({
      where: { 
        user_id: userId,
        type: 'COMMENT',
        target_id: commentId,
      }
    });
    if (existingReport) {
      return res.status(409).json({
        Message: '이미 신고한 댓글입니다.',
        ResultCode: 'ERR_DUPLICATE_REPORT',
      });
    }

    // 7. 신고 생성
    const report = await models.report.create({
      user_id: userId,
      type: 'COMMENT',
      target_id: commentId,
      category : upperCategory,
      reason,
    });

    // 8. 댓글 상태 변경 (신고됨 -> 검토 대기 상태)
    await models.comment.update(
      { status: 'REPORT_PENDING' },
      { where: { id: commentId } } // 신고된 댓글만 상태 변경
    );

    // 9. 응답
    return res.status(201).json({
      Message: '댓글 신고가 접수되었습니다.',
      ResultCode: 'SUCCESS',
      Report: report.get({ plain: true })
    });

  } catch (err) {
    console.error('reportComment error:', err);
    return res.status(500).json({
      Message: 'Internal server error',
      ResultCode: 'ERR_INTERNAL_SERVER',
      msg: err.toString(),
    });
  }
}


module.exports = { 
    getCommunities,
    getCommunity, 
    createCommunity,
    updateCommunity,
    deleteCommunity,
    reportCommunity,
    createComment,
    updateComment,
    deleteComment,
    reportComment
};