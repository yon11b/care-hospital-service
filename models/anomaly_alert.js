module.exports = (sequelize, DataTypes) => {
  const anomaly_alert = sequelize.define(
    "anomaly_alert",
    {
      user_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        comment: "이상 탐지된 사용자 ID",
      },

      failed_logins: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: "리뷰 관련 이상치 점수",
      },
      reviews_last_5m: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: "리뷰 관련 이상치 점수",
      },
      is_processed: {
        type: DataTypes.BOOLEAN,
        allowNull: true,
        comment: "리뷰 관련 이상치 점수",
      },
    },
    {
      tableName: "anomaly_alerts",
      underscored: true,
      createAt: "created_at",
      updatedAt: "processed_at",
    }
  );

  return anomaly_alert;
};
