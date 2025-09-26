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
async function getCommunity(req, res) {
  try{
    // 경로 파라미터에서 communiyId 가져오기
    const communityId = req.params.communityId; 
    const page = parseInt(req.query.page) || 1 ; // 댓글 페이지
    const limit = parseInt(req.query.limit) || 10; // 페이지당 댓글 수
    const offset = (page - 1) * limit; // 페이징 -> 쿼리에서 몇 번째 레코드부터 가져올지 지정


    const resp = await models.Community.findOne({
      where: {
        id : communityId, 
      },
      attributes:[
        'id', 'title', 'content', 'created_at', 'img',
        [Sequelize.literal(`(
            SELECT COUNT(*)
            FROM "comments" AS c
            WHERE c.community_id = ${communityId}
        )`), 'totalComments']  // 댓글 + 대댓글 포함
      ],
      include:[ 
        // 작성자 (id, 이름)
        {
          model: models.User,
          attributes: ['id', 'name'] 
        },
        // 댓글 (대댓글 아님)
        {
          model:models.Comments,
          attributes : ['id', 'content', 'parent_id', 'created_at'],
          where : { parent_id : null },
          required: false,  // LEFT OUTER JOIN -> 댓글 없는 글 조회 가능
          separate: true, // 별도 쿼리로 가져오기
          limit,
          offset,
          order : [['created_at', 'ASC']], // 댓글 오름차순
          include:[
            // 댓글 작성자
            {
              model : models.User, 
              attributes : ['id', 'name']
            },
            // 대댓글
            {
              model:models.Comments, 
              as:'replies', // self-association alias
              attributes : ['id', 'content', 'created_at'],
              separate: true, // 대댓글도 별도 쿼리
              order: [['created_at', 'ASC']], // 대댓글 오름차순              
              include:[
                {
                  model:models.User, // 대댓글 작성자
                  attributes: ['id', 'name']
                },
              ],
            }
          ],
        }
      ],
      order: [['created_at', 'DESC']], // 게시글 생성일 최신순
    });

    if (!resp) {
      return res.status(404).send({ 
        Message: '게시글이 존재하지 않습니다.',
        ResultCode: 'ERR_NOT_FOUND',
      });
    }

    // 응답(Response) 보내기
    res.status(200).json({
        Message: 'Success',
        ResultCode: 'OK',
        Community: resp,
    });


  } catch (err){
    //bad request
    console.log(err);
    res.status(400).send({
        Message : 'Invalid parameter - 잘못된 쿼리',
        ResultCode : 'ERR_INVALID_PARAMETER',
        Error: err.toString(),
    });
  }
}


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