// 게시글 커뮤니티

module.exports = (sequelize, DataTypes) => { 
    const Community = sequelize.define('Community', { 
        id: { 
            type: DataTypes.INTEGER, 
            primaryKey: true, 
            autoIncrement: true, 
        }, 
        userId: { 
            type: DataTypes.INTEGER, 
            allowNull: false, 
            field: 'user_id', 
        }, 
        title: { 
            type: DataTypes.STRING, 
            allowNull: false, 
        }, 
        content: { 
            type: DataTypes.TEXT, 
            allowNull: false, 
        }, 
        img: { 
            type: DataTypes.JSONB, 
            allowNull: true, 
        }, 
    }, { 
        tableName: 'community', 
        timestamps: true, // createdAt, updatedAt
        underscored: true, 
    }); 
    
    Community.associate = (models) => { 
        // Community (1 : N) User 
        Community.belongsTo(models.User, { foreignKey: 'user_id'}); 
        // Community (1 : N) Comments 
        Community.hasMany(models.Comments, { foreignKey: 'community_id', sourceKey: 'id'}); 
    }; 
    
    return Community; 

};