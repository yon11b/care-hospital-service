const express = require('express');
const router = express.Router();
// const { authMiddleware } = require('../../../middleware/auth');

//const multer = require('multer');
const path = require('path');
const db = require('../../../models');
const config = require('../../../config/config.json')[process.env.NODE_ENV || 'development'];
// const storage = multer.diskStorage({
//   destination: (req, file, cb) => {
//     cb(null, config.path.upload_path);
//   },
//   filename: (req, file, cb) => {
//     const extension = path.extname(file.originalname);
//     const basename = path.basename(file.originalname, extension);
//     cb(null, basename + '-' + Date.now() + extension);
//   },
// });

// const upload = multer({
//   storage: storage,
// });

const { getCommunities, getCommunity, createCommunity, updateCommunity, deleteCommunity } = require('./community');

// 전체 글 조회 -> GET /rest/community
router.get('/', getCommunities);

// 글 하나 조회 -> GET /rest/community/:communityId
router.get('/:communityId', getCommunity);

// 작성자가 글 작성 (jwt 필요) -> POST /rest/community/posts
// router.post('/posts', authMiddleware, createCommunity );
// // PATCH /rest/community/posts/{postId}
// router.patch('/posts/:postId', authMiddleware, updateCommunity);
// // DELETE /rest/community/posts/{postId}
// router.delete('/posts/:postId', authMiddleware, deleteCommunity);


module.exports = router;