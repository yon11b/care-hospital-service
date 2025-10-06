// middleware/requireRole.js
// 세션 로그인 + 권한 확인
// roles: 문자열 하나("admin") 또는 배열(["admin", "owner"]) 모두 가능
function requireRole(roles) {
  return (req, res, next) => {
    if (!req.session.user) {
      return res.status(401).json({
        result: false,
        Message: "로그인이 필요합니다",
        ResultCode: "requireRole - Unauthorized",
      });
    }

    const userRole = req.session.user.role;
    const allowedRoles = Array.isArray(roles) ? roles : [roles]; // 항상 배열로 변환

    if (!allowedRoles.includes(userRole)) {
      return res.status(403).json({
        result: false,
        Message: `접근 권한이 없습니다. (필요 권한: ${allowedRoles.join(
          ", "
        )}, 현재 권한: ${userRole})`,
        ResultCode: "Forbidden",
      });
    }

    // 통과
    next();
  };
}

module.exports = { requireRole };
