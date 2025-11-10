const express = require("express");
const router = express.Router();

const { getEcommerces, getEcommerce } = require("./ecommerce");

router.get("/", getEcommerces); // 요양기기 전체 목록 조회

router.get("/:id", getEcommerce); // 요양기기 1개 조회

module.exports = router;
