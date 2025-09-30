// models/review.js
module.exports = (sequelize, DataTypes) => {
  const review = sequelize.define(
    'review', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
        },
        user_id: {
            type: DataTypes.INTEGER,
            allowNull: true,
        },
        facility_id: {
            type: DataTypes.INTEGER,
            allowNull: true,
        },
        reservation_id: {
            type: DataTypes.INTEGER,
            allowNull: true,
        },
        content: {
            type: DataTypes.TEXT,
            allowNull: true,
        },
        rating: {
            type: DataTypes.INTEGER,
            allowNull: true,
            validate: {
                min: 1,
                max: 5,
            },
        },
        images: {
            type: DataTypes.JSONB,
            allowNull: true,
        },
        visited: {
            type: DataTypes.BOOLEAN,
            defaultValue: false,
        },
        reply: {
            type: DataTypes.TEXT,
            allowNull: true,
        },
        tags: {
            type: DataTypes.ARRAY(DataTypes.TEXT),
            allowNull: true,
        },
        status: {
            type: DataTypes.ENUM('ACTION', 'DELETED', 'REPORT_PENDING'),
            defaultValue: 'ACTION',
        },
        deleted_at: {
            type: DataTypes.DATE,
            allowNull: true,
        },
    }, {
        tableName: 'reviews',
        timestamps: true,
        underscored: true,
        indexes: [
            { name: 'fk_reports_user', fields: ['user_id'], unique: false },
            { name: 'fki_fk_reports_user', fields: ['facility_id'], unique: false },
            { name: 'fki_reviews_reservation_fkey', fields: ['reservation_id'], unique: false },
        ],
    }
  );

  review.associate = (models) => {
    // N:1 - reviews : user
    review.belongsTo(models.user, { foreignKey: 'user_id', targetKey: 'id', onDelete: 'SET NULL', onUpdate: 'NO ACTION' });
    // N:1 - reviews : facilities
    review.belongsTo(models.facility, { foreignKey: 'facility_id', targetKey: 'id', onDelete: 'SET NULL', onUpdate: 'NO ACTION'  });
    review.belongsTo(models.reservation, { foreignKey: 'reservation_id', onDelete: 'SET NULL', onUpdate: 'NO ACTION'  });

    // 1:N - reviews : reports (신고)
    review.hasMany(models.report, { foreignKey: 'target_id', sourceKey: 'id', scope: { type: 'REVIEW' } });
  };

  return review;
};
