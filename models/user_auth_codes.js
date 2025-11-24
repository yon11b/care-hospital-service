// models/user_auth_codes.js
module.exports = (sequelize, DataTypes) => {
  const user_auth_codes = sequelize.define(
    'user_auth_codes',
    {
      phone: {
        type: DataTypes.STRING(13),
        allowNull: false,
        primaryKey: true,
      },
      code: {
        type: DataTypes.STRING(6),
        allowNull: false,
      },
      expires_at: {
        type: DataTypes.DATE,
        allowNull: false,
      },
    },
    {
      tableName: 'user_auth_codes',
      timestamps: false, // createdAt, updatedAt 없음
    }
  );

  return user_auth_codes;
};
