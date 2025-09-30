const models = require("../../../models");
const session = require("express-session");
const sha256 = require("sha256");
const axios = require("axios");
const crypto = require("crypto");
require("dotenv").config();

const diseaseTranslations = {
  psoriasis: "건선",
  rosacea: "주사피부염",
  eczema_dermatitis: "습진성 피부염",
  acne: "여드름",
  actinic_keratosis: "광선각화증",
  alopecia_androgenetica: "안드로겐성 탈모",
  alopecia_areata: "원형 탈모증",
  bullous_dermatosis: "수포성 피부병",
  chloasma: "기미",
  corn: "티눈",
  dermatofibroma: "피부섬유종",
  erysipelas: "단독",
  erythema_multiforme: "다형홍반",
  folliculitis: "모낭염",
  furuncle: "종기",
  haemangioma: "혈관종",
  herpes: "포진",
  herpes_simplex: "단순포진",
  iga_vasculitis: "IgA 혈관염",
  keloid: "켈로이드",
  keratosis_follicularism: "모낭각화증",
  lichen_planus: "편평태선",
  lupus_erythematosus: "루푸스",
  molluscum_contagiosum: "전염성 연속종",
  nevus: "모반",
  paronychia: "조갑주위염",
  pityriasis_alba: "백선양 인설",
  pityriasis_rosea: "장미색 비강진",
  prurigo_nodularis: "결절성 양진",
  sebaceous_cyst: "피지낭종",
  sebaceousnevus: "피지선 모반",
  seborrheic_dermatitis: "지루피부염",
  seborrheic_keratosis: "지루각화증",
  skin_tag: "쥐젖",
  stasis_dermatitis: "정체성 피부염",
  syringoma: "한관종",
  tinea_capitis: "두부백선",
  tinea_corporis: "몸 백선",
  tinea_cruris: "사타구니 백선",
  tinea_manuum: "손 백선",
  tinea_pedis: "발 백선",
  tinea_unguium: "손·발톱 무좀",
  tinea_versicolor: "어루러기",
  urticaria: "두드러기",
  urticaria_papular: "구진성 두드러기",
  varicella: "수두",
  verruca_plana: "편평사마귀",
  verruca_vulgaris: "보통사마귀",
  vitiligo: "백반증",
};

async function predictDisease(req, res) {
  try {
    const url =
      "https://www.ailabapi.com/api/portrait/analysis/skin-disease-detection";
    console.log(">>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>");
    console.log(req.file);
    const base64Image = req.file
      ? req.file.buffer.toString("base64")
      : undefined;
    const FormData = require("form-data");
    const form = new FormData();
    form.append("image", req.file.buffer, {
      filename: req.file.originalname,
      contentType: req.file.mimetype,
    });

    const resp = await axios.post(url, form, {
      headers: {
        ...form.getHeaders(),
        "ailabapi-api-key": process.env.AILAB_API_KEY,
      },
    });

    const data = resp.data;
    const resultsEnglish = data?.data?.results_english || {};

    // 한글 변환
    const resultsKorean = {};
    for (const [key, value] of Object.entries(resultsEnglish)) {
      resultsKorean[diseaseTranslations[key] || key] = value;
    }
    const saved = await models.skin_analysis.create({
      user_id: req.session.user?.id || null,
      //image_path: req.file.originalname, // S3 안쓰므로 파일 이름만 저장
      body_part: data?.data?.body_part || null,
      image_quality: data?.data?.image_quality || null,
      results: resultsKorean,
    });

    return res.json({
      ...data,
      data: {
        ...data.data,
        results_korean: resultsKorean,
      },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "질병 예측 실패" });
  }
}

module.exports = {
  predictDisease,
};
