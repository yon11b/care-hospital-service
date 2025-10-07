// models/like.js

module.exports = (sequelize, DataTypes) => {
  const like = sequelize.define('like', {
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'users', key: 'id' },
      onUpdate: 'NO ACTION',
      onDelete: 'NO ACTION'
    },
    facility_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'facilities', key: 'id' },
      onUpdate: 'NO ACTION',
      onDelete: 'NO ACTION'
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    }
  }, {
    tableName: 'likes',
    timestamps: true,
    underscored: true,
    createdAt: 'created_at',
    updatedAt: false,
    indexes: [
      {
        unique: true,
        fields: ['user_id', 'facility_id'] // 사용자가 다양한 기기로 동시에 좋아요 누를 시 막는 제약
      }
    ]
  });

  like.associate = (models) => {
    like.belongsTo(models.user, { foreignKey: 'user_id' });
    like.belongsTo(models.facility, { foreignKey: 'facility_id'});
  };

  return like;
};
