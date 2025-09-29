// 게시글 커뮤니티

module.exports = (sequelize, DataTypes) => { 
    const community = sequelize.define('community', { 
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
        images: { 
            type: DataTypes.JSONB, 
            allowNull: true, 
        }, 
    }, { 
        tableName: 'community', 
        timestamps: true, // createdAt, updatedAt
        underscored: true, 
    }); 
    
    community.associate = (models) => { 
        // Community (1 : N) User 
        community.belongsTo(models.user, { foreignKey: 'user_id'}); 
        // Community (1 : N) comments 
        community.hasMany(models.comments, { foreignKey: 'community_id', sourceKey: 'id', onDelete: 'CASCADE'}); 
    }; 
    
    return community; 

};