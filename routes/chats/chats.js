const models = require("../../models");

async function getRooms(req, res) {
  try {
    const { user_type, user_id } = req.body;
    let whereClause = {};

    if (user_type === "staff") {
      // 직원이면 같은 시설의 채팅방만 보기
      const staff = await models.staff.findOne({ where: { id: user_id } });
      if (!staff) throw new Error("Invalid staff ID");

      whereClause = { facility_id: staff.facility_id };
    } else if (user_type === "guardian") {
      // 보호자면 본인 관련 채팅방만 보기
      whereClause = { guardian_id: user_id };
    }

    const rooms = await models.chat_room.findAll({
      where: whereClause,
      include: [
        { model: models.facility, attributes: ["id", "name"] },
        { model: models.user, attributes: ["id", "name"] },
      ],
    });

    res.json({
      Message: "Chat rooms select successfully.",
      ResultCode: "ERR_OK",
      Size: rooms.length,
      Response: rooms,
    });
  } catch (err) {
    console.error(err);

    res.status(500).json({
      Message: "Internal server error",
      ResultCode: "ERR_INTERNAL_SERVER",
      Status: 500,
    });
  }
}

async function getMessages(req, res) {
  try {
    const { user_type, user_id } = req.body;
    const { room_id } = req.params;

    // 우선 해당 room이 그 사용자의 권한 범위에 있는지 확인
    const room = await models.chat_room.findOne({ where: { room_id } });
    if (!room) throw new Error("Room not found");

    if (user_type === "guardian" && room.guardian_id !== parseInt(user_id)) {
      throw new Error("Not authorized to view this room");
    }

    if (user_type === "staff") {
      const staff = await models.staff.findOne({ where: { id: user_id } });
      if (!staff || room.facility_id !== staff.facility_id) {
        throw new Error("Not authorized to view this room");
      }
    }

    const messages = await models.chat_message.findAll({
      where: { room_id },
      order: [["created_at", "ASC"]],
    });

    res.json({
      Message: "Chat messages select successfully.",
      ResultCode: "ERR_OK",
      Size: messages.length,
      Response: messages,
    });
  } catch (err) {
    console.error(err);

    if (err.name === "SequelizeDatabaseError") {
      // DB 관련 오류
      return res.status(500).json({
        Message: "Internal server error",
        ResultCode: "ERR_INTERNAL_SERVER",
        Status: 500,
      });
    }

    if (err.message.includes("Not authorized")) {
      // 명시적 권한 오류
      return res.status(403).json({
        Message:
          "Access denied: You do not have permission to access this resource.",
        ResultCode: "ERR_FORBIDDEN",
        Status: 403,
      });
    }

    // 그 외 일반적인 서버 오류
    res.status(500).json({
      Message: "Internal server error",
      ResultCode: "ERR_INTERNAL_SERVER",
      Status: 500,
    });
  }
}
module.exports = {
  getMessages,
  getRooms,
};
