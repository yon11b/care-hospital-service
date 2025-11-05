module.exports = (sequelize, DataTypes) => {
  const chat_message = sequelize.define(
    "chat_message",
    {
      room_id: { type: DataTypes.STRING, allowNull: false },
      sender_id: { type: DataTypes.STRING, allowNull: false },
      sender_type: {
        type: DataTypes.ENUM("staff", "guardian"),
        allowNull: false,
      },
      content: { type: DataTypes.TEXT, allowNull: false },
    },
    {
      tableName: "chat_messages",
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
    }
  );

  chat_message.associate = (models) => {
    chat_message.belongsTo(models.facility, { foreignKey: "facility_id" });
    chat_message.belongsTo(models.user, { foreignKey: "guardian_id" });
  };
  return chat_message;
};
