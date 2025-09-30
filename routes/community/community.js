// 사용자 입장에서의 게시글 api

const models = require('../../models');
const sha256 = require('sha256');
const app = require('../../app');
const Sequelize = require('sequelize');
const AWS = require('aws-sdk');

// 1. 커뮤니티 전체 리스트 조회 
// 제목, 작성자, 작성일, 댓글수, 이미지, 내용물(3줄정도)
// GET /community
async function getCommunities(req, res) {
  try{
    const limit = parseInt(req.query.limit, 10) || 10;  // 한 번에 가져올 개수 : 기본 10개
    const lastId = req.query.lastId || null ; // 마지막으로 가져온 글 id

    const where = {};
    if (lastId) {
      where.id = { [Sequelize.Op.lt]: lastId }; // 마지막 글보다 작은 id만 가져오기
    }

    const resp = await models.community.findAll({
      where,
      attributes: [
        'id', 'title', 'createdAt', 'content', 'images', 

        // 총 댓글수
        [Sequelize.literal(`(
            SELECT COUNT(*)
            FROM "comments" AS c
            WHERE c.community_id = "community"."id"
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
// GET /community/:id
async function getCommunity(req, res) {
  try{
    // 경로 파라미터에서 id 가져오기
    const communityId = parseInt(req.params.id, 10);

    const page = parseInt(req.query.page, 10) || 1 ; // 댓글 페이지
    const limit = parseInt(req.query.limit, 10) || 10; // 페이지당 댓글 수
    const offset = (page - 1) * limit; // 페이징 -> 쿼리에서 몇 번째 레코드부터 가져올지 지정


    const resp = await models.community.findOne({
      where: {
        id : communityId, 
      },
      attributes:[
        'id', 'title', 'content', 'created_at', 'images',
        [Sequelize.literal(`(
            SELECT COUNT(*)
            FROM "comments" AS c
            WHERE c.community_id = "community"."id"
        )`), 'totalComments']  // 댓글 + 대댓글 포함
      ],
      include:[ 
        // 작성자 (id, 이름)
        {
          model: models.user,
          attributes: ['id', 'name'] 
        },
        // 댓글 (대댓글 아님)
        {
          model: models.comment,
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
              model : models.user, 
              attributes : ['id', 'name']
            },
            // 대댓글
            {
              model:models.comment, 
              as:'replies', // self-association alias
              attributes : ['id', 'content', 'created_at'],
              separate: true, // 대댓글도 별도 쿼리
              order: [['created_at', 'ASC']], // 대댓글 오름차순              
              include:[
                {
                  model:models.user, // 대댓글 작성자
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
      return res.status(404).json({ 
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
    res.status(400).json({
        Message : 'Invalid parameter - 잘못된 쿼리',
        ResultCode : 'ERR_INVALID_PARAMETER',
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
// PATCH /community/:id 
async function updateCommunity(req, res) {
  try{
    const userId = req.user.id; // jwt를 통해 user_id
    
    // 로그인 확인
    if(!userId){
        return res.status(401).send({
        Message: 'Unauthorized - 로그인 필요',
        ResultCode: 'ERR_UNAUTHORIZED',
      });
    }

    const communityId = parseInt(req.params.id, 10); // 경로에서 커뮤니티 글 id
    const { title, content, removeImages, finalOrder } = req.body; // 제목, 내용, 삭제할 이미지, 이미지 순서

    // FormData 단일 값 보정 -> 배열 변환
    if (typeof removeImages === 'string') removeImages = [removeImages];
    if (typeof finalOrder === 'string') finalOrder = [finalOrder];

    // 수정할 글 조회
    const community = await models.community.findOne({ where: { id: communityId } });
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
      imageUrls = imageUrls.concat(uploadedUrls); // 기존 + 새 이미지 추가
    }

    // 3. 순서 변경 (클라이언트에서 최종 순서 배열 전달)
    // finalOrder = ["url3", "url1", "url2"] 같은 배열
    if (Array.isArray(finalOrder) && finalOrder.length > 0) {
      const unique = new Set(finalOrder); // 중복 이미지 X
      // finalOrder 기준으로 먼저 정렬 + 누락된 이미지들은 뒤에 붙이기
      imageUrls = [...finalOrder.filter(url => imageUrls.includes(url)),
                   ...imageUrls.filter(url => !unique.has(url))];
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
// DELETE /community/:id
const s3 = new AWS.S3({
  region: process.env.AWS_S3_REGION,
  accessKeyId: process.env.AWS_S3_ACCESS_KEY,
  secretAccessKey: process.env.AWS_S3_SECRET_KEY,
});
        
async function deleteCommunity(req, res) {
  const t = await models.sequelize.transaction(); // 트랜잭션 시작

  try{
    const userId = req.user.id; // jwt를 통해 user_id
    const communityId = parseInt(req.params.id, 10); // 경로에서 커뮤니티 글 id

    if(!userId){ // 로그인 확인
        return res.status(401).send({
        Message: 'Unauthorized - 로그인 필요',
        ResultCode: 'ERR_UNAUTHORIZED',
      });
    }

    // 삭제할 글 조회
    const community = await models.community.findOne({ where: { id: communityId } });
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

    
    // S3 이미지 삭제
    if (community.images && community.images.length > 0) {
        const deleteParams = {
          Bucket: process.env.AWS_BUCKET,
          Delete: {
            Objects: community.images.map(url => ({ Key: decodeURIComponent(new URL(url).pathname.slice(1)) })), // 가능하면 Key를 DB에 저장
          },
        };

      // 실패 시 글 삭제 롤백
      console.log('S3 삭제할 객체:', deleteParams.Delete.Objects); // 로그 확인
      await s3.deleteObjects(deleteParams).promise();
      console.log('S3 이미지 삭제 완료'); // 성공 시 로그
    }

    // 글 삭제 (CASCADE로 댓글/신고도 삭제됨)
    await community.destroy({ transaction: t });

    await t.commit();
    
    return res.json({
      Message: '게시글이 삭제되었습니다.',
      ResultCode: 'OK',
      DeletedCommunityId : communityId
    });

  }catch(err){
    await t.rollback(); // 트랜잭션 롤백
    console.error('deleteCommunity error:', err);

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
    deleteCommunity
};