const express = require("express");

const router = express.Router();
const { getRooms, getRoomsGuardian, getMessages } = require("./chats");
const { authMiddleware } = require("../../middleware/authMiddleware");
// /rooms → 전체 채팅방 조회
router.post("/rooms", getRooms);
router.get("/rooms/guardian", authMiddleware, getRoomsGuardian);

// /rooms/:roomId → 특정 채팅방 메시지 조회
router.post("/rooms/:room_id", getMessages);

module.exports = router;
