const jwt = require('jsonwebtoken');

// 개발 환경에서는 fallback으로 'your_jwt_secret' 사용 가능
const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret';
const JWT_EXPIRE = '1h'; // 만료시간 1시간

// jwt 생성
function generateToken(user) {
    return jwt.sign(
        { id: user.id, email: user.email }, 
        JWT_SECRET, 
        { expiresIn: JWT_EXPIRE }
    );
}

function generateRefreshToken() {
    return require('crypto').randomBytes(64).toString('hex'); // 길고 랜덤한 문자열
}

// jwt 검증
function verifyToken(token) {
    try {
        return jwt.verify(token, JWT_SECRET);
    } catch (err) {
        return null;
    }
}

module.exports = { generateToken, generateRefreshToken, verifyToken };
