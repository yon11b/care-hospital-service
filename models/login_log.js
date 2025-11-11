module.exports = (sequelize, DataTypes) => {
  const login_log = sequelize.define(
    "login_log",
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      user_id: {
        type: DataTypes.STRING,
      },
      user_type: {
        type: DataTypes.STRING,
      },
      login_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
      },
      ip_address: {
        type: DataTypes.STRING(45), // IPv4/IPv6 대응
      },
      user_agent: {
        type: DataTypes.TEXT,
      },
    },
    {
      tableName: "login_logs",
      timestamps: false,
    }
  );

  return login_log;
};
