const fs = require("fs");
const util = require("util");
const path = require("path");
const textToSpeech = require("@google-cloud/text-to-speech");

// GCP 인증: 환경 변수 GOOGLE_APPLICATION_CREDENTIALS 에 서비스 계정 키 경로 설정 필요
// export GOOGLE_APPLICATION_CREDENTIALS="/path/to/key.json"

const client = new textToSpeech.TextToSpeechClient();
async function generateTTS(req, res) {
  try {
    const text = req.body.text;
    if (!text) return res.status(400).json({ error: "text 필요" });

    const request = {
      input: { text },
      voice: { languageCode: "ko-KR", ssmlGender: "FEMALE" },
      audioConfig: { audioEncoding: "LINEAR16" },
    };

    const [response] = await client.synthesizeSpeech(request);

    // 바로 다운로드
    const outputFile = path.join(__dirname, "분자.wav"); // 서버 경로
    await fs.promises.writeFile(outputFile, response.audioContent, "binary");
    console.log("✅ 서버에 파일 저장 완료:", outputFile);
    console.log(`✅ TTS 생성 완료`);
    res.json({ Response: outputFile });
  } catch (err) {
    console.error("❌ TTS 생성 실패:", err);
    res.status(500).json({ error: err.toString() });
  }
}

module.exports = {
  generateTTS,
};
// 테스트
//generateTTS("나무, 자동차, 분자", "hello.mp3");
