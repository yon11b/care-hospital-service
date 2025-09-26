// models/user.js 
// 사용자 
module.exports = (sequelize, DataTypes) => { 
    const User = sequelize.define('User', { 
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
    User.associate = (models) => { 
        // User(사용자) 1 : N Community(커뮤니티) 
        User.hasMany(models.Community, { foreignKey: 'user_id' }); 
        // User(사용자) 1 : N Comments (댓글) 
        User.hasMany(models.Comments, { foreignKey: 'user_id', sourceKey: 'id' }); 
    }; 
    
    return User; 
};