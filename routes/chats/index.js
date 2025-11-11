const express = require("express");

const router = express.Router();
const { getRooms, getMessages } = require("./chats");
// /rooms → 전체 채팅방 조회
router.post("/rooms", getRooms);

// /rooms/:roomId → 특정 채팅방 메시지 조회
router.post("/rooms/:room_id", getMessages);

module.exports = router;
