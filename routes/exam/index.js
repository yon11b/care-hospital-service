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
  gradeJudgment,
  dementia,
} = require("./dementia");
const { skin_analysis } = require("./skin_analysis");

router.post("/skin-analysis", upload.single("image"), skin_analysis);

router.post("/dementia/time", gradeTimeOrientation);
router.post("/dementia/place", gradePlaceOrientation);
router.post("/dementia/registration", gradeRegistration);
router.post("/dementia/seven", gradeSerialSevens);
router.post("/dementia/delay", gradeDelayedRecall);
router.post("/dementia/naming", gradeNaming);
router.post("/dementia/repeat", gradeRepetition);
router.post("/dementia/three", gradeThreeStepCommand);
router.post("/dementia/construct", gradeConstructionalAbility);
router.post("/dementia/judge", gradeJudgment);
router.post("/dementia", dementia);
module.exports = router;
