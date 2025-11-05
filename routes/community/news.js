const models = require('../../models');
const sha256 = require('sha256');
const app = require('../../app');
const Sequelize = require('sequelize');
const AWS = require('aws-sdk');
const { Op } = require('sequelize');
const axios = require("axios");
const xml2js = require("xml2js");


// 최신 보건소 요양, 어르신 관련 정보 조회
// 1. 전체 목록 조회 (제목, OO보건소, 작성일 등)
// GET /community/news
async function getHealthNews(req, res) {
  try{
    // 쿼리에서 페이지, limit 받아오기 (기본값 설정)
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const offset = (page - 1) * limit;    

    // health_news 조회
    const { rows: news, count: total } = await models.healthNews.findAndCountAll({
      order: [['created_at_api', 'DESC']], // 최신순
      limit,
      offset
    });

    // 결과 생성
    const data = news.map(ns => ({
      id: ns.id,
      source: ns.source,
      title: ns.title,
      content: ns.content,
      created_at_api : ns.created_at_api, // 작성일
      link : ns.link,
      extra : ns.extra,
      created_at : ns.created_at,
      updated_at : ns.updated_at
    }));    

    // 성공 응답
    res.status(200).json({
      Message: "최신 보건소 정보 목록 조회 성공",
      ResultCode: "SUCCESS",
      page,
      limit,
      total, // 전체 정보 개수
      data
    });
    
  }catch(err){
    console.error('최신 보건소 정보 전체 조회 실패 error:', err);

    return res.status(500).json({
      Message: 'Internal server error',
      ResultCode: 'ERR_INTERNAL_SERVER',
      msg: err.toString(),
    });
  }
}

// 2. 하나 조회
// GET /community/news/:newsId
async function getHealthNewsById(req, res) {
  try {
    const newsId = parseInt(req.params.newsId, 10);

    if (isNaN(newsId)) {
      return res.status(400).json({
        Message: "잘못된 요청입니다.",
        ResultCode: "ERR_INVALID_ID",
      });
    }

    const news = await models.healthNews.findOne({ where: { id: newsId } });

    if (!news) {
      return res.status(404).json({
        Message: "해당 뉴스가 존재하지 않습니다.",
        ResultCode: "ERR_NOT_FOUND",
      });
    }

    res.status(200).json({
      Message: "최신 보건소 정보 상세 조회 성공",
      ResultCode: "SUCCESS",
      data: {
        id: news.id,
        source: news.source,
        title: news.title,
        content: news.content,
        created_at_api: news.created_at_api,
        link: news.link,
        extra: news.extra,
        created_at: news.created_at,
        updated_at: news.updated_at
      }
    });
  } catch (err) {
    console.error('최신 보건소 정보 상세 조회 실패:', err);
    res.status(500).json({
      Message: 'Internal server error',
      ResultCode: 'ERR_INTERNAL_SERVER',
      msg: err.toString(),
    });
  }
}


module.exports = {
  getHealthNews,
  getHealthNewsById
};