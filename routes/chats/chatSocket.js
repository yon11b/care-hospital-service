// sockets/chatSocket.js
const models = require("../../models");

function initChatSocket(io) {
  io.on("connection", (socket) => {
    console.log("Socket connected:", socket.id);

    // 직원 대시보드 접속
    // socket.on("joinDashboard", (facility_id) => {
    //   socket.join(`facility:${facility_id}`);
    //   console.log(`${socket.id} joined facility:${facility_id}`);
    // });

    // 직원 대시보드 접속
    socket.on("joinDashboard", ({ facility_id }) => {
      socket.join(`facility:${facility_id}`);
      console.log(`${socket.id} joined facility:${facility_id}`);
    });

    // 채팅방 접속
    socket.on("joinRoom", async ({ facility_id, guardian_id }) => {
      try {
        const room_id = `${facility_id}:${guardian_id}`;
        socket.join(room_id);
        socket.room_id = room_id;

        // DB에 없으면 방 생성
        await models.chat_room.findOrCreate({
          where: { room_id },
          defaults: {
            facility_id,
            guardian_id,
            status: "pending",
            last_message: "",
          },
        });

        // 최근 메시지 불러오기
        const recent = await models.chat_message.findAll({
          where: { room_id },
          order: [["created_at", "ASC"]],
          limit: 100,
        });

        socket.emit("chatHistory", recent);
        console.log(`Sent chat history for room ${room_id}`);
      } catch (err) {
        console.error("joinRoom error:", err);
      }
    });

    // **채팅방 나가기**
    socket.on("leaveRoom", ({ facility_id, guardian_id }) => {
      const room_id = `${facility_id}:${guardian_id}`;
      socket.leave(room_id);
      console.log(`${socket.id} left room ${room_id}`);
    });

    // 메시지 전송
    socket.on("sendMessage", async (data) => {
      try {
        const { facility_id, guardian_id, sender, content, sender_type } = data;
        if (!facility_id || !guardian_id || !sender || !content) return;

        const room_id = `${facility_id}:${guardian_id}`;

        // DB 저장
        const newMsg = await models.chat_message.create({
          room_id,
          facility_id,
          guardian_id,
          sender_id: sender,
          sender_type,
          content,
        });

        // 마지막 메시지 갱신
        await models.chat_room.update(
          { last_message: content },
          { where: { room_id } }
        );

        // 같은 방 참여자에게 실시간 전송
        io.to(room_id).emit("receiveMessage", newMsg);

        // 직원 대시보드에도 갱신 이벤트 전송
        io.to(`facility:${facility_id}`).emit("updateRoomList", {
          room_id,
          last_message: content,
          timestamp: new Date(),
        });

        console.log(`[${room_id}] ${sender}: ${content}`);
      } catch (err) {
        console.error("sendMessage error:", err);
      }
    });

    socket.on("disconnect", () => {
      console.log("Socket disconnected:", socket.id);
    });
  });
}

module.exports = initChatSocket;
