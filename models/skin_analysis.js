// models/skin_analysis.js
module.exports = (sequelize, DataTypes) => {
  const skin_analysis = sequelize.define(
    "skin_analysis",
    {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      user_id: { type: DataTypes.INTEGER, allowNull: true },
      body_part: { type: DataTypes.STRING, allowNull: true },
      image_quality: { type: DataTypes.FLOAT, allowNull: true },
      results: { type: DataTypes.JSONB, allowNull: true },
    },
    {
      tableName: "skin_analysis",
      comment: "피부질병분석예측",
      createdAt: "created_at",
      updatedAt: "updated_at",
    }
  );

  //Foreign keys
  skin_analysis.associate = (models) => {
    //   facility.hasMany(models.staff, { foreignKey: 'facilityId' });
    //   facility.hasMany(models.reviews, { foreignKey: 'facilityId' });
    //   facility.hasMany(models.reservation, { foreignKey: 'facilityId' });
    //   facility.hasMany(models.consult, { foreignKey: 'facilityId' });
    //skin_analysis.belongsTo(models.user, { foreignKey: "user_id" });
  };

  return skin_analysis;
};
