// models/review.js
module.exports = (sequelize, DataTypes) => {
  const review = sequelize.define(
    'review',
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      user_id: { // 작성자
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      facility_id: { // 기관
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      content: { // 리뷰 내용
        type: DataTypes.TEXT,
        allowNull: false,
      },
      rating: { // 평점
        type: DataTypes.INTEGER,
        allowNull: true,
        validate: {
          min: 1,
          max: 5,
        },
      },
      images: { // 이미지 -> 최대 4개로 할 것임.
        type: DataTypes.JSONB,
        allowNull: true,
      },
      visited: { // 방문인증 -> true 방문 , false 방문 X
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },
      reply: { // 기관 답변
        type: DataTypes.TEXT,
        allowNull: true,
      },
      tags: { // 태그 -> "친절해요" 등
        type: DataTypes.ARRAY(DataTypes.TEXT),
        allowNull: true,
      },
      status: { // 리뷰 상태
        type: DataTypes.ENUM('ACTIVE', 'DELETED', 'REPORT_PENDING'),
        defaultValue: 'ACTIVE',
      },
      created_at: { // 작성일
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
      },
      updated_at: { // 수정일
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
      },
      deleted_at: { // status가 DELETED 되는 날 (삭제일)
        type: DataTypes.DATE,
        allowNull: true,
      },
    },
    {
      tableName: 'reviews',
      timestamps: true,
      underscored: true,
      paranoid: true,       // deleted_at 컬럼 기반 소프트 삭제
      createdAt: 'created_at',
      updatedAt: 'updated_at',
      deletedAt: 'deleted_at',
    }
  );

  // deleted_at 업데이트 시 status 자동 변경
  review.addHook('beforeDestroy', (review) => {
    review.status = 'DELETED';
  });

  review.associate = (models) => {
    // N:1 - reviews : user
    review.belongsTo(models.user, { foreignKey: 'user_id', targetKey: 'id', onDelete: 'NO ACTION', onUpdate: 'NO ACTION' });

    // N:1 - reviews : facilities
    review.belongsTo(models.facility, { foreignKey: 'facility_id', targetKey: 'id', onDelete: 'NO ACTION', onUpdate: 'NO ACTION' });

    // 1:N - reviews : reports (신고)
    review.hasMany(models.report, { foreignKey: 'target_id', sourceKey: 'id', scope: { type: 'REVIEW' } });
  };

  return review;
};
