module.exports = (sequelize, DataTypes) => {
  const notification = sequelize.define(
    "notification",
    {
      title: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: "제목",
      },
      content: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: "내용",
      },
      picture: {
        type: DataTypes.JSONB,
        allowNull: true,
        comment: "공지사항에 올릴 사진(추석연휴기념 소식~)",
      },
    },
    {
      tableName: "notification",
      comment: "공지사항",
      createdAt: "created_at",
      updatedAt: "updated_at",
    }
  );

  //Foreign keys
  notification.associate = (models) => {
    //   facility.hasMany(models.staff, { foreignKey: 'facilityId' });
    //   facility.hasMany(models.reviews, { foreignKey: 'facilityId' });
    //   facility.hasMany(models.reservation, { foreignKey: 'facilityId' });
    //   facility.hasMany(models.consult, { foreignKey: 'facilityId' });
    notification.belongsTo(models.facility, { foreignKey: "facility_id" });
  };

  return notification;
};
