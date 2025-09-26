// models/user.js 
// 사용자 
module.exports = (sequelize, DataTypes) => { 
    const user = sequelize.define('user', { 
        id: { 
            type: DataTypes.INTEGER, 
            primaryKey: true, 
            autoIncrement: true, // GENERATED ALWAYS AS IDENTITY와 매칭 
        }, 
        name: { 
            type: DataTypes.STRING, 
            allowNull: true, // 테이블에서 NULL 허용 
        }, 
        email: { 
            type: DataTypes.STRING, 
            allowNull: true, 
        }, 
        password: { 
            type: DataTypes.STRING, 
            allowNull: true, 
        }, 
        phone: { 
            type: DataTypes.STRING, 
            allowNull: true, 
        }, 
        facilityLikes: { 
            type: DataTypes.INTEGER, 
            allowNull: true, 
            field: 'facilityLikes', // DB 컬럼명 그대로 
        }, 
        currentLocation: { 
            type: DataTypes.STRING, 
            allowNull: 
            true, field: 'currentLocation', // 현재 위치(좌표) 
        }, 
    },{   
        tableName: 'user', 
        timestamps: true, 
        underscored: true, // createdAt -> created_at 매핑 
    }); 
    
    // 다른 테이블과 관계 정의 
    user.associate = (models) => { 
        // user(사용자) 1 : N community(커뮤니티) 
        user.hasMany(models.community, { foreignKey: 'user_id' }); 
        // user(사용자) 1 : N comments (댓글) 
        user.hasMany(models.comments, { foreignKey: 'user_id', sourceKey: 'id' }); 
    }; 
    
    return user; 
};