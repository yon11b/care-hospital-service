const fs = require("fs");
const axios = require("axios");

async function transcribeService(audioFile) {
  try {
    const client_id = process.env.NAVER_CLOUD_CSR_CLIENT_ID;
    const secret_key = process.env.NAVER_CLOUD_CSR_SECRET_KEY;

    const url = `https://naveropenapi.apigw.ntruss.com/recog/v1/stt?lang=Kor`;
    const response = await axios.post(url, audioFile, {
      headers: {
        "x-ncp-apigw-api-key-id": client_id,
        "x-ncp-apigw-api-key": secret_key,
        "Content-Type": "application/octet-stream",
      },
    });
    return response.data;
  } catch (err) {
    console.error("텍스트로 변환 실패", err.response?.data || err.message);
    return { valid: false, error: err.response?.data || err.message };
  }
}

async function transcribe(req, res) {
  try {
    //const file = req.file; // multer 등으로 업로드된 파일
    const audioFile = fs.readFileSync(req.body.audioFile); // 파일을 바이너리로 읽음
    const text = await transcribeService(audioFile);
    res.json({ text });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Transcription failed", msg: err.message });
  }
}
module.exports = {
  transcribe,
};
