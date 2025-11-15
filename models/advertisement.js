// models/advertisement.js
module.exports = (sequelize, DataTypes) => {
  const advertisement = sequelize.define(
    "advertisement",
    {
      // ID
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
        comment: "Primary Key",
      },
      user_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      // 기관 id
      facility_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      // 광고 내용
      description: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      // 승인 상태: 승인, 거절, 대기
      approval_status: {
        type: DataTypes.STRING,
        allowNull: true,
        defaultValue: "pending",
        comment: "승인, 거절, 대기",
      },
      // 광고 시작일
      start_date: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: "광고 시작일",
      },
      // 광고 종료일
      end_date: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: "광고 종료일",
      },
      // 승인 처리일
      approved_at: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: "승인 처리일",
      },
    },
    {
      tableName: "advertisements",
      createdAt: "created_at",
      updatedAt: "updated_at",
    }
  );

  advertisement.associate = (models) => {
    advertisement.belongsTo(models.facility, { foreignKey: "facility_id" });
    advertisement.belongsTo(models.staff, { foreignKey: "user_id" });
  };

  return advertisement;
};
