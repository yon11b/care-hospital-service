const fs = require("fs");
const axios = require("axios");
const express = require("express");

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

("use strict");

/**
 * Lists available voices for the specified language.
 *
 * @param {string} languageCode - The language code.
 */
async function listVoices(req, res) {
  const languageCode = "en";
  const textToSpeech = require("@google-cloud/text-to-speech");

  const client = new textToSpeech.TextToSpeechClient();

  const [result] = await client.listVoices({ languageCode });
  const voices = result.voices;

  voices.forEach((voice) => {
    console.log(`${voice.name} (${voice.ssmlGender}): ${voice.languageCodes}`);
  });
}
/**
 * Sythesizes sample text into an .mp3 file.
 */
// async function synthesize() {
//   const textToSpeech = require("@google-cloud/text-to-speech");
//   const fs = require("fs");
//   const util = require("util");

//   const client = new textToSpeech.TextToSpeechClient();
//   const text = "간 장 공 장 공 장 장";

//   const request = {
//     input: { text: text },
//     // voice: { languageCode: "en-US", ssmlGender: "NEUTRAL" },
//     voice: { languageCode: "ko-KR", ssmlGender: "NEUTRAL" },
//     audioConfig: { audioEncoding: "MP3" },
//   };

//   const [response] = await client.synthesizeSpeech(request);
//   // Write the binary audio content to a local file
//   const writeFile = util.promisify(fs.writeFile);
//   await writeFile("output2.mp3", response.audioContent, "binary");
//   console.log("Audio content written to file: output.mp3");
// }
// Imports the Google Cloud client library
const speech = require("@google-cloud/speech");

const client = new speech.SpeechClient();

/**
 * Calls the Speech-to-Text API on a demo audio file.
 */
async function quickstart(gcsUri) {
  // The path to the remote LINEAR16 file stored in Google Cloud Storage
  //const gcsUri = "gs://cloud-samples-data/speech/brooklyn_bridge.raw";

  // The audio file's encoding, sample rate in hertz, and BCP-47 language code
  const audio = {
    uri: gcsUri,
  };
  const config = {
    encoding: "LINEAR16",
    sampleRateHertz: 16000,
    languageCode: "en-US",
  };
  const request = {
    audio: audio,
    config: config,
  };

  // Detects speech in the audio file
  const [response] = await client.recognize(request);
  const transcription = response.results
    .map((result) => result.alternatives[0].transcript)
    .join("\n");
  console.log(`Transcription: ${transcription}`);
  return transcription;
}

// listVoices("en");
async function transcribe(req, res) {
  try {
    //const file = req.file; // multer 등으로 업로드된 파일
    // const audioFile = fs.readFileSync(req.body.audioFile); // 파일을 바이너리로 읽음

    const audioBuffer = req.body;
    console.log("받은 파일:", audioBuffer);
    console.log("받은 파일 크기:", audioBuffer.length);
    const text = await transcribeService(audioBuffer);
    res.json({ text });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Transcription failed", msg: err.message });
  }
}
module.exports = {
  transcribe,
  listVoices,
  quickstart,
};
