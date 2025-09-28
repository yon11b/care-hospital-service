// auth.js에서 만든 JWT 검증 함수 가져오기
const { verifyToken } = require('./auth');
const models = require('../models');

/**
 * Express 미들웨어: JWT 인증 및 DB 사용자 확인
 * 1. 요청 헤더에서 JWT를 확인
 * 2. 토큰 검증 후 payload 반환
 * 3. DB에서 실제 사용자 존재 여부 확인
 * 4. req.user에 사용자 정보 저장 후 next()
 */
async function authMiddleware(req, res, next) {
    
    // 1. 요청 헤더에서 'Bearer <JWT 토큰>' 가져오기
    const authHeader = req.headers['authorization']; 
    
    // 2. 토큰 추출 ( 'Bearer ' 제거 )
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) { // 토큰 없음
        return res.status(401).json({ 
            message: 'authMiddleware - Token missing' 
        });
    }
    
    // 3. 토큰 검증
    // 검증 성공 시 payload 반환, 실패 시 null
    const decoded = verifyToken(token, process.env.JWT_SECRET);
    if (!decoded){ 
        return res.status(401).json({ 
            message: 'authMiddleware - Invalid token' 
        });
    }

    // 4. DB에서 실제 사용자 확인 (payload.id 기준)
    // 로그아웃 처리 시 DB에서 삭제된 사용자도 검증 실패 처리 가능
    const user = await models.user.findByPk(decoded.id);
    if (!user) {
        return res.status(401).json({ 
            message: 'User not found' 
        });
    }

    // 5. 검증 성공 -> req.user에 DB에서 가져온 최신 사용자 정보 저장
    req.user = decoded; // id, email 등

    next();
}

module.exports = {authMiddleware};
