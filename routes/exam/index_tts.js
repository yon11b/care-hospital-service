const express = require("express");
const router = express.Router();
const multer = require("multer");
const upload = multer({ storage: multer.memoryStorage() });

const {
  gradeTimeOrientation,
  gradePlaceOrientation,
  gradeRegistration,
  gradeSerialSevens,
  gradeDelayedRecall,
  gradeNaming,
  gradeRepetition,
  gradeThreeStepCommand,
  gradeConstructionalAbility,
  gradeJugment,
  saveScore,
} = require("./dementia");
const { skin_analysis } = require("./skin_analysis");

const { generateTTS } = require("./tss");
router.post("/skin-analysis", upload.single("image"), skin_analysis);

router.post("/dementia/time", gradeTimeOrientation);
router.post("/dementia/place", gradePlaceOrientation);
router.post(
  "/dementia/registration",
  upload.single("audioFile"),
  gradeRegistration
);
router.post("/dementia/seven", gradeSerialSevens);
router.post("/dementia/delay", gradeDelayedRecall);
router.post("/dementia/naming", upload.single("audioFile"), gradeNaming);
router.post("/dementia/repeat", upload.single("audioFile"), gradeRepetition);
router.post("/dementia/three", gradeThreeStepCommand);
router.post("/dementia/construct", gradeConstructionalAbility);
router.post("/dementia/judge", gradeJugment);
router.post("/dementia/save", saveScore);
router.post("/dementia/tss", generateTTS);
module.exports = router;
