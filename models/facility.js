

module.exports = (sequelize, DataTypes) => {
  const facility = sequelize.define(
    "facility",
    {
      kind: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: "기관분류",
      },
      name: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: "기관이름",
      },
      address: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: "기관주소",
      },
      url: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: "기관사이트",
      },
      telno: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: "기관 전화번호",
      },
      description: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: "병원 설명",
      },
      approval_status: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: "기관등록승인상태",
      },
      sido_name: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: "시,도 이름",
      },
      sggu_name: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: "시군구 이름",
      },
      dong_name: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: "동 이름",
      },
      postno: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: "우편번호",
      },
      established_date: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: "기관설립날짜",
      },
      longitude: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: "x 좌표 위치",
      },
      latitude: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: "y 좌표 위치",
      },
      care_code: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: "요양기호",
      },
      facility_number: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: "사업자등록번호",
      },
    },
    {
      tableName: "facilities",
      comment: "기관",
      createdAt: "created_at",
      updatedAt: "updated_at",
    }
  );

  //Foreign keys
  facility.associate = (models) => {
    facility.hasMany(models.meal, { foreignKey: "facility_id" });
    facility.hasMany(models.staff, { foreignKey: "facility_id" });
    facility.hasOne(models.facility_status, { foreignKey: "facility_id" });
    facility.hasMany(models.advertisement, { foreignKey: "facility_id" });
    facility.hasMany(models.notice, { foreignKey: "facility_id" });

    facility.hasMany(models.review, { foreignKey: 'facility_id', sourceKey: 'id' });
    facility.hasMany(models.reservation, { foreignKey: 'facility_id' });
  
    facility.belongsToMany(models.user, { through: models.like, foreignKey: 'facility_id', otherKey: 'user_id' });
  };

  return facility;
};