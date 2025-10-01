module.exports = (sequelize, DataTypes) => {
  const meal = sequelize.define(
    "meal",
    {
      facility_id: {
        type: DataTypes.BIGINT,
        allowNull: false,
        primaryKey: true, // 여기서 PK로 지정
      },
      today_meal_desc: {
        type: DataTypes.JSONB,
        allowNull: true,
        comment: "오늘의 급식 목록(아침, 점심, 저녁)",
      },
      breakfast_meal_picture_url: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: "오늘의 급식 사진(아침)",
      },
      lunch_meal_picture_url: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: "오늘의 급식 사진(점심)",
      },
      dinner_meal_picture_url: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: "오늘의 급식 사진(저녁)",
      },
      week_meal_picture_url: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: "이번주 급식 사진",
      },
      meal_date: {
        type: DataTypes.DATE,
        allowNull: false,
        comment: "오늘의 날짜(급식의 날짜)",
      },
    },
    {
      tableName: "meals",
      comment: "급식",
      createdAt: "created_at",
      updatedAt: "updated_at",
    }
  );

  //Foreign keys
  meal.associate = (models) => {
    //   meal.hasMany(models.staff, { foreignKey: 'facilityId' });
    //   facility.hasMany(models.reviews, { foreignKey: 'facilityId' });
    //   facility.hasMany(models.reservation, { foreignKey: 'facilityId' });
    //   facility.hasMany(models.consult, { foreignKey: 'facilityId' });
    //   facility.hasMany(models.likes, { foreignKey: 'facilityId' });
    meal.belongsTo(models.facility, { foreignKey: "facility_id" });
  };

  return meal;
};
