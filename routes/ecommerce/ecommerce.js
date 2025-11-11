const models = require("../../models");
async function getEcommerces(req, res) {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    const keyword = req.query.keyword || "";

    // 전체 개수 조회
    const totalCount = await models.ecommerce.count({
      where: {
        ...(keyword && { title: { [Op.iLike]: `%${keyword}` } }),
      },
    });
    const resp = await models.ecommerce.findAll({
      where: {
        ...(keyword && { title: { [Op.iLike]: `%${keyword}` } }),
      },
      limit,
      offset,
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
    console.error(err);
    res.status(400).send({
      result: false,
      msg: err.toString(),
    });
  }
}

async function getEcommerce(req, res) {
  try {
    const pid = req.params.id;
    const resp = await models.ecommerce.findOne({
      where: {
        id: pid,
      },
    });
    if (!resp) {
      return res.status(404).json({
        Message: "Ecommerce item not found.",
        ResultCode: "ERR_NOT_FOUND",
        Status: 404,
      });
    }

    res.json({
      Message: "Ecommerce select successfully.",
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
  getEcommerces,
  getEcommerce,
};
