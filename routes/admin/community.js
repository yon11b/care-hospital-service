const models = require("../../models");
const Sequelize = require("sequelize");
const { Op } = require("sequelize");
// 1. 커뮤니티 전체 리스트 조회
// 제목, 작성자, 작성일, 댓글수, 이미지, 내용물(3줄정도)
// GET /community
async function getCommunities(req, res) {
  try {
    const limit = parseInt(req.query.limit, 10) || 10; // 한 번에 가져올 개수 : 기본 10개
    const communities = await models.community.findAll({
      attributes: {
        include: [
          // 총 댓글수
          [
            Sequelize.literal(`(
            SELECT COUNT(*)
            FROM "comments" AS c
            WHERE c.community_id = "community"."id"
            AND c.status IN ('ACTION', 'REPORT_PENDING')
        )`),
            "totalComments",
          ],
        ],
      },
      include: [
        {
          // 작성자 정보 (이름)
          model: models.user,
          attributes: ["id", "name"],
        },
      ],
      order: [["createdAt", "DESC"]], // 최신 글 먼저
      limit,
    });

    // 응답(Response) 보내기
    res.status(200).json({
      Message: "Success",
      ResultCode: "OK",
      Community: communities, // resp가 []이면 게시글 없음
    });
  } catch (err) {
    //bad request
    console.log(err);
    res.status(400).send({
      Message: "Invalid parameter - 잘못된 쿼리",
      ResultCode: "ERR_INVALID_PARAMETER",
      Error: err.toString(),
    });
  }
}

// 2. 커뮤니티 특정 글(1개) 선택하고 보기(조회)
// GET /communities/:communityId
async function getCommunity(req, res) {
  try {
    const communityId = parseInt(req.params.id, 10);
    if (isNaN(communityId)) {
      return res.status(400).json({
        Message: "Invalid parameter - 잘못된 쿼리",
        ResultCode: "ERR_INVALID_PARAMETER",
      });
    }

    // 1. 커뮤니티 글 조회
    const community = await models.community.findOne({
      where: {
        id: communityId,
      },
      include: [{ model: models.user, attributes: ["id", "name"] }],
    });

    if (!community) {
      return res.status(404).json({
        Message: "게시글이 존재하지 않습니다.",
        ResultCode: "ERR_NOT_FOUND",
      });
    }

    // 2. 루트 댓글 + 모든 하위 댓글(root_parent_id 기준) 조회
    const comments = await models.comment.findAll({
      where: {
        community_id: communityId,
      },
      order: [["created_at", "ASC"]],
      include: [{ model: models.user, attributes: ["id", "name"] }],
    });

    // 3. 루트 댓글과 하위 댓글 그룹핑
    const rootComments = comments.filter((c) => c.parent_id === null);
    const replies = comments.filter((c) => c.parent_id !== null);

    const commentsTree = rootComments.map((root) => {
      const children = replies
        .filter((r) => r.root_parent_id === root.id)
        .map((r) => ({
          commentId: r.id,
          content: r.content,
          parentId: r.parent_id,
          rootParentId: r.root_parent_id,
          userId: r.user_id,
          userName: r.user?.name || null, // 멘션 대상자
          created_at: r.createdAt,
        }));

      return {
        commentId: root.id,
        content: root.content,
        userId: root.user_id,
        userName: root.user?.name || null,
        created_at: root.createdAt,
        replies: children, // 모든 하위 댓글 포함
      };
    });

    // 4. 응답
    return res.status(200).json({
      Message: "Success",
      ResultCode: "OK",
      Community: {
        id: community.id,
        title: community.title,
        content: community.content,
        images: community.images,
        status: community.status,
        created_at: community.createdAt,
        updated_at: community.updatedAt,
        deleted_at: community.deleted_at,
        user: { id: community.user.id, name: community.user.name },
        comments: commentsTree,
      },
    });
  } catch (err) {
    console.error("getCommunity error:", err);
    return res.status(500).json({
      Message: "Internal server error",
      ResultCode: "ERR_INTERNAL_SERVER",
      Error: err.toString(),
    });
  }
}

// 4. 커뮤니티 특정 글(1개) 수정 -> jwt 필요
// PATCH /community/:communityId
async function updateCommunity(req, res) {
  try {
    const communityId = parseInt(req.params.id, 10); // 경로에서 커뮤니티 글 id
    let { title, content, status } = req.body;

    if (isNaN(communityId)) {
      return res.status(400).json({
        Message: "Invalid parameter - 잘못된 쿼리",
        ResultCode: "ERR_INVALID_PARAMETER",
      });
    }

    const community = await models.community.findOne({
      where: {
        id: communityId,
      },
    });
    if (!community) {
      return res.status(404).json({
        Message: "게시글이 존재하지 않습니다.",
        ResultCode: "ERR_NOT_FOUND",
      });
    }

    // DB 업데이트
    await community.update({
      title: title || community.title,
      content: content || community.content,
      status,
    });

    // DB 반영 후 최신 값 가져오기
    await community.reload();

    // 응답(Response) 보내기
    return res.status(200).json({
      Message: "게시글이 성공적으로 수정되었습니다.",
      ResultCode: "SUCCESS",
      Community: community,
    });
  } catch (err) {
    console.error("updateCommunity error:", err);
    return res.status(500).json({
      Message: "Internal server error",
      ResultCode: "ERR_INTERNAL_SERVER",
      msg: err.message || err.toString(),
    });
  }
}

module.exports = { getCommunities, getCommunity, updateCommunity };
