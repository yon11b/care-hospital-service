module.exports = (sequelize, DataTypes) => {
  const facility_log = sequelize.define(
    "facility_log",
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      facility_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      user_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      action: {
        type: DataTypes.STRING(20),
        allowNull: false,
      },
      changed_data: {
        type: DataTypes.JSONB,
        allowNull: true,
      },
    },
    {
      tableName: "facility_logs",
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
    }
  );
  return facility_log;
};
