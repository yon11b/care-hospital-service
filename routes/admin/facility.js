async function getFacilities(req, res) {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    const latitude = req.query.latitude
      ? parseFloat(req.query.latitude)
      : 37.5664;
    const longitude = req.query.longitude
      ? parseFloat(req.query.longitude)
      : 126.9779;
    const keyword = req.query.keyword || "";
    const kind = req.query.kind
      ? req.query.kind.split(",").map((k) => k.trim())
      : [];

    // 전체 개수 조회
    const totalCount = await models.facility.count({
      where: {
        ...(keyword && { name: { [Op.iLike]: `%${keyword}%` } }),
        ...(longitude && { longitude: { [Op.ne]: null } }),
        ...(latitude && { latitude: { [Op.ne]: null } }),
        ...(kind.length > 0 && { kind: { [Op.in]: kind } }),
      },
      distinct: true,
    });

    // 데이터 조회
    const resp = await models.facility.findAll({
      where: {
        ...(keyword && { name: { [Op.iLike]: `%${keyword}%` } }),

        ...(longitude && { longitude: { [Op.ne]: null } }),
        ...(latitude && { latitude: { [Op.ne]: null } }),
        ...(kind.length > 0 && { kind: { [Op.in]: kind } }),
      },
      attributes: {
        include: [
          [
            literal(
              `ST_DistanceSphere(
              ST_MakePoint(longitude::double precision, latitude::double precision),
              ST_MakePoint(${longitude}, ${latitude})
              )`
            ),
            "distance",
          ],
        ],
      },
      include: [
        { model: models.facility_status },
        { model: models.advertisement },
        { model: models.staffs },
      ],
      order: [[literal("distance"), "ASC"]],
      limit,
      offset,
      distinct: true,
    });

    const isLastPage = offset + resp.length >= totalCount;
    const totalPage = Math.ceil(totalCount / resp.length);

    res.json({
      Message: "Facility select successfully.",
      ResultCode: "ERR_OK",
      Size: resp.length,
      TotalCount: totalCount,
      TotalPage: totalPage,
      Page: page,
      IsLastPage: isLastPage,
      Response: resp,
    });
  } catch (err) {
    console.log(err);
    res.status(400).send({
      result: false,
      msg: err.toString(),
    });
  }
}

async function getFacility(req, res) {
  try {
    //pid: 받아온 id 파라미터
    const pid = req.params.id;
    const resp = await models.facility.findOne({
      where: {
        id: pid,
      },
      include: [
        { model: models.facility_status },
        { model: models.advertisement },
        { model: models.staffs },
      ],
    });
    if (!resp) {
      return res.status(404).json({
        Message: "Facility not found",
        ResultCode: "ERR_NOT_FOUND",
        status: "404",
      });
    }
    res.json({
      Message: "Facility select successfully.",
      ResultCode: "ERR_OK",
      Response: resp,
    });
  } catch (err) {
    //bad request
    console.log(err);
    res.status(400).send({
      result: false,
      msg: err.toString(),
    });
  }
}

module.exports = {
  getFacilities,
  getFacility,
};
