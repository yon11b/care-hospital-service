// search.js
const { Sequelize, Op } = require("sequelize");
const models = require("../../models");
const { gptPromptJson } = require("./prompt");

// ==============================
// 시설 기본 정보 조건 생성
// ==============================
function buildFacilityWhere(filter) {
  const where = {};
  const loc = filter.location || {};

  if (filter.facility_kind) where.kind = filter.facility_kind;
  if (loc.sido) where.sido_name = loc.sido;
  if (loc.sggu) where.sggu_name = loc.sggu;
  if (loc.dong) where.dong_name = loc.dong;

  // 최근 2년 내 설립된 시설
  if (filter.conditions?.newly_established) {
    const date = new Date();
    date.setFullYear(date.getFullYear() - 2);
    where.established_date = { [Op.gte]: date };
  }

  return where;
}

// ==============================
// 시설 상태 조건 생성
// ==============================
function buildStatusWhere(filter) {
  const where = {};
  const cond = filter.conditions || {};
  const staff = filter.staff_conditions || {};

  // 🔹 min_patients / max_patients가 null일 때 제외
  if (cond.min_patients != null)
    where.total_patients_count = {
      ...(where.total_patients_count || {}),
      [Op.gte]: cond.min_patients,
    };
  if (cond.max_patients != null)
    where.total_patients_count = {
      ...(where.total_patients_count || {}),
      [Op.lte]: cond.max_patients,
    };

  const mapping = {
    total_doctor: "doctor_count",
    medc_doctor: "medc_doctor_count",
    dent_doctor: "dent_doctor_count",
    hb_doctor: "hb_doctor_count",
  };

  for (const key in mapping) {
    const col = mapping[key];
    const c = staff[key];
    if (!c) continue;

    // 🔹 null 체크 강화
    if (c.exact != null) where[col] = c.exact;
    else {
      if (c.min != null)
        where[col] = { ...(where[col] || {}), [Op.gte]: c.min };
      if (c.max != null)
        where[col] = { ...(where[col] || {}), [Op.lte]: c.max };
    }
  }

  return where;
}

// ==============================
// 시설 검색 쿼리 실행
// ==============================
async function findFacilities(filter) {
  const facilityWhere = buildFacilityWhere(filter);
  //console.log(`facilityWhere:` + facilityWhere);
  const statusWhere = buildStatusWhere(filter);

  const hasCoords =
    filter.location?.near_me &&
    filter.location.coords?.latitude &&
    filter.location.coords?.longitude;

  const attributes = hasCoords
    ? {
        include: [
          [
            Sequelize.literal(`
              ST_DistanceSphere(
                ST_MakePoint(longitude::double precision, latitude::double precision),
                ST_MakePoint(${filter.location.coords.longitude}, ${filter.location.coords.latitude})
              )
            `),
            "distance",
          ],
        ],
      }
    : undefined;

  const order = hasCoords
    ? Sequelize.literal("distance ASC")
    : [["created_at", "DESC"]];

  const results = await models.facility.findAll({
    where: facilityWhere,
    attributes,
    include: [
      {
        model: models.facility_status,
        where: statusWhere,
        required: true,
      },
    ],
    order,
    limit: 50,
  });

  return results.map((f) => f.toJSON());
}

// ==============================
// ✅ 최종 export: GPT prompt까지 포함
// ==============================
async function searchFacilities(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).send({
        Message: "Method not allowed",
        ResultCode: "ERR_INVALID_DATA",
      });
    }

    // console.log("teststsetsets");
    // console.log(req.body);
    const gptPrompt = req.body.usersentence;
    // return res.status(200).send({
    //   result: true,
    //   msg: gptPrompt,
    // });

    if (!gptPrompt || typeof gptPrompt !== "string") {
      return res
        .status(400)
        .send({ result: false, msg: "userSentence required" });
    }
    //console.log(gptPrompt);

    const promptResult = await gptPromptJson(gptPrompt);
    console.log(promptResult);
    console.log("===============");
    const facilities = await findFacilities(promptResult);
    console.log(facilities);

    // 🔹 최종 JSON 반환
    return res.json({
      Message: "Facility select successfully.",
      ResultCode: "ERR_OK",
      Size: facilities.length,
      Response: facilities,
    });
  } catch (err) {
    //bad request
    console.log(err);
    return res.status(400).send({
      result: false,
      msg: err.toString(),
    });
  }
}

module.exports = { searchFacilities };
