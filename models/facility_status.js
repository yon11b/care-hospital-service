// models/facility_status.js
module.exports = (sequelize, DataTypes) => {
  const facility_status = sequelize.define(
    "facility_status",
    {
      // ID
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
        comment: "Primary Key",
      },
      // 현재 환자 수
      total_patients_count: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: "현재 환자의 수",
      },
      // 남성 환자 수
      man_patients_count: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: "남성 환자 수",
      },
      // 여성 환자 수
      woman_patients_count: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: "여성 환자 수",
      },
      // 수용 가능 인원
      user_capacity: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: "수용가능인원",
      },
      // 의사 수
      doctor_count: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: "의사의 수",
      },
      // 보호사 수
      manager_count: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: "보호사의 수",
      },
      // 한방 의사 수
      hb_doctor_count: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: "한방 의사 수",
      },
      // 치과 의사 수
      dent_doctor_count: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: "치과 의사 수",
      },
      // 의과 의사 수
      medc_doctor_count: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: "의과 의사 수",
      },
    },
    {
      tableName: "facility_status",
      createdAt: "created_at",
      updatedAt: "updated_at",
      underscored: false,
    }
  );

  facility_status.associate = function (models) {
    facility_status.belongsTo(models.facility, { foreignKey: "facility_id" });
  };

  return facility_status;
};
