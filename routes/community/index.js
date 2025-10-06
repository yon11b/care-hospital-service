const express = require('express');
const router = express.Router();
const multer = require('multer');
const aws = require('aws-sdk');
const multerS3 = require('multer-s3');
const path = require('path');
const db = require('../../models');
const config = require('../../config/config.json')[process.env.NODE_ENV || 'development'];

const { authMiddleware } = require('../../middleware/authMiddleware.js');


aws.config.update({
  region: process.env.AWS_S3_REGION,
  accessKeyId: process.env.AWS_S3_ACCESS_KEY,
  secretAccessKey: process.env.AWS_S3_SECRET_KEY,
});

const s3 = new aws.S3();
const upload = multer({
  storage: multerS3({
    s3: s3,
    bucket: process.env.AWS_BUCKET,
    contentType: multerS3.AUTO_CONTENT_TYPE,
    key: (req, file, callback) => {
      //console.log(req.body.today_meal_url);
      const ext = path.extname(file.originalname);
      console.log('================');
      console.log(file);
      console.log(ext);
      // 콜백 함수 두 번째 인자에 파일명(경로 포함)을 입력
      callback(null, `image/community/${req.user.id}-${Date.now()}${ext}`);
    },
  }),
});


const { 
  getCommunities, 
  getCommunity, 
  createCommunity, 
  updateCommunity, 
  deleteCommunity,
  reportCommunity   
} = require('./community');
const {  
  createComment,
  updateComment,
  deleteComment,
  reportComment
} = require('./comment');

router.get('/', getCommunities); // 전체 글 조회
router.get('/:communityId', getCommunity);// 글 하나 조회

const communityUpload = upload.array('images', 4)
router.post('/', authMiddleware, communityUpload, createCommunity);// 글 작성
router.patch('/:communityId', authMiddleware, communityUpload, updateCommunity); // 글 수정
router.delete('/:communityId', authMiddleware, deleteCommunity); // 글 삭제
router.post('/:communityId/report', authMiddleware, reportCommunity ); // 글 신고

router.post('/:communityId/comment', authMiddleware, createComment ); // 댓글 작성
router.patch('/:communityId/comment/:commentId', authMiddleware, updateComment ); // 댓글 수정
router.delete('/:communityId/comment/:commentId', authMiddleware, deleteComment ); // 댓글 삭제
router.post('/:communityId/comment/:commentId/report', authMiddleware, reportComment ); // 댓글 신고

module.exports = router;