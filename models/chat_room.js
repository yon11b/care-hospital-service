module.exports = (sequelize, DataTypes) => {
  const chat_room = sequelize.define(
    "chat_room",
    {
      room_id: { type: DataTypes.STRING, primaryKey: true }, // facilityId:guardianId
      last_message: { type: DataTypes.STRING, allowNull: true },
    },
    {
      tableName: "chat_rooms",
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
    }
  );
  chat_room.associate = (models) => {
    chat_room.belongsTo(models.facility, { foreignKey: "facility_id" });
    chat_room.belongsTo(models.user, { foreignKey: "guardian_id" });
  };

  return chat_room;
};
