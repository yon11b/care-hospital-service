const models = require('../../models');
const sha256 = require('sha256');
const app = require('../../app');
const Sequelize = require('sequelize');
const AWS = require('aws-sdk');
const { Op } = require('sequelize');


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
// 신고 기능 - 댓글
// ======================
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
    createComment,
    updateComment,
    deleteComment,
    reportComment
};