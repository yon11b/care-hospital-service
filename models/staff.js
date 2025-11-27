module.exports = (sequelize, DataTypes) => {
  const staff = sequelize.define(
    "staff",
    {
      password: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: "비밀번호",
      },
      name: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: "직원 이름",
      },
      email: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
        comment: "이메일",
      },
      approval_status: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: "기관 등록 요청 후 관리자 승인 상태",
      },
      role: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: "대표인지 직원인지",
      },
      facility_number: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: "사업자등록번호",
      },
      ykiho: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: "요양기호",
      },      
      facility_token: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: "기관 토큰(직원인증을 위해)",
      },
    },
    {
      tableName: "staffs",
      comment: "기관직원",
      createdAt: "created_at",
      updatedAt: "updated_at",
    }
  );

  //Foreign keys
  staff.associate = (models) => {
    //   facility.hasMany(models.staff, { foreignKey: 'facilityId' });
    //   facility.hasMany(models.reviews, { foreignKey: 'facilityId' });
    //   facility.hasMany(models.reservation, { foreignKey: 'facilityId' });
    //   facility.hasMany(models.consult, { foreignKey: 'facilityId' });
    staff.belongsTo(models.facility, { foreignKey: "facility_id" });
    staff.hasMany(models.login_log, {
      foreignKey: "user_id",
      onDelete: "CASCADE",
    });
    staff.hasMany(models.advertisement, {
      foreignKey: "user_id",
      onDelete: "CASCADE",
    });
  };

  return staff;
};
