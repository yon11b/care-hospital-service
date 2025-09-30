// 게시글 커뮤니티

module.exports = (sequelize, DataTypes) => { 
    const reservation = sequelize.define('reservation', { 
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true, // 필요하면 자동 증가
    },
    user_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
        model: 'user', // 테이블 이름
        key: 'id',
        },
    },
    facility_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
        model: 'facilities', // 테이블 이름
        key: 'id',
        },
    },
    reservation_time: {
        type: DataTypes.DATE, // timestamp with time zone
        allowNull: false,
    },
    patience_kind: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    patience_name: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    status: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    created_at: {
        type: DataTypes.DATE,
        allowNull: true,
        defaultValue: DataTypes.NOW,
    },
    updated_at: {
        type: DataTypes.DATE,
        allowNull: true,
        defaultValue: DataTypes.NOW,
    },
    }, {
        tableName: 'reservation',
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        timestamps: true, 
        underscored: true, // snake_case 컬럼명 사용
    });
    
    reservation.associate = (models) => { 
      reservation.belongsTo(models.user, { foreignKey: 'user_id' });
      reservation.belongsTo(models.facility, { foreignKey: 'facility_id' });    
    
    };

    return reservation; 
};