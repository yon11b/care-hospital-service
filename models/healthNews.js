// models/health_notice.js
module.exports = (sequelize, DataTypes) => {
  const healthNews = sequelize.define('healthNews', {
    id: { 
      type: DataTypes.INTEGER, 
      primaryKey: true, 
      autoIncrement: true 
    },

    // 공통 필드
    source: { // 출처: 예) '양천구보건소', '서대문구보건소'
      type: DataTypes.STRING,
      allowNull: false,
    },
    title: { // 제목
      type: DataTypes.STRING(1000),
      allowNull: false,
    },
    content: { // 내용
      type: DataTypes.TEXT,
      allowNull: true,
    },
    created_at_api: { // 작성일 (API 데이터 기준)
      type: DataTypes.DATE,
      allowNull: true,
    },
    link: { // (선택) 원본 게시글 링크
      type: DataTypes.STRING(1000),
      allowNull: true,
    },

    // API마다 달라지는 나머지 필드
    extra: {
      type: DataTypes.JSON,
      allowNull: true,
      comment: "API 원본 데이터 전체 저장",
    },
  }, {
    tableName: 'health_news',
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",    
  });

  return healthNews;
};
