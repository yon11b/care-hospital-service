// 사용자 입장에서의 게시글 api

const models = require('../../../models');
const sha256 = require('sha256');
const app = require('../../../app');
const Sequelize = require('sequelize');

// 1. 커뮤니티 전체 리스트 조회 
// 제목, 작성자, 작성일, 댓글수, 이미지, 내용물(3줄정도)
// GET /rest/community
async function getCommunities(req, res) {
  try{
    const limit = parseInt(req.query.limit) || 10;  // 한 번에 가져올 개수 : 기본 10개
    const lastId = req.query.lastId || null ; // 마지막으로 가져온 글 id

    const where = {};
    if (lastId) {
      where.id = { [Sequelize.Op.lt]: lastId }; // 마지막 글보다 작은 id만 가져오기
    }

    const resp = await models.Community.findAll({
      where,
      attributes: [
        'id', 'title', 'createdAt', 'content',

        // 이미지 배열 중 첫 번째
        // 이미지 有 "firstImage": "url.jpg", 이미지 無 null 값 반환
        [models.sequelize.literal(`("images"->>0)`), 'firstImage'],

        // 총 댓글수
        [Sequelize.literal(`(
            SELECT COUNT(*)
            FROM "comments" AS c
            WHERE c.community_id = "Community"."id"
        )`), 
        'totalComments'
        ]
      ],
      include: [
        { // 작성자 정보 (이름)
          model: models.User,         
          attributes: ['id', 'name']        
        },
      ],
      order: [['created_at', 'DESC']], // 최신 글 먼저
      limit,
    });

    // 응답(Response) 보내기
    res.status(200).json({
        Message: 'Success',
        ResultCode: 'OK',
        Community: resp, // resp가 []이면 게시글 없음
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
// GET /rest/community/:communityId



// 3. 커뮤니티 특정 글(1개) 생성 -> jwt 필요
// POST /rest/community 
// 사용자의 user_id -> jwt 토큰에서 가져오기


// 4. 커뮤니티 특정 글(1개) 수정 -> jwt 필요
// PATCH /rest/community/:id 


// 3. 커뮤니티 특정 글(1개) 삭제 -> jwt 필요
// DELETE /rest/community/:id


module.exports = { 
    getCommunities,
    getCommunity, 
    //createCommunity,
    //updateCommunity,
    //deleteCommunity
};