// 게시글 커뮤니티

module.exports = (sequelize, DataTypes) => { 
    const community = sequelize.define('community', { 
        id: { 
            type: DataTypes.INTEGER, 
            primaryKey: true, 
            autoIncrement: true, 
        }, 
        user_id: { 
            type: DataTypes.INTEGER, 
            allowNull: true, 
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
        status: {
            type: DataTypes.ENUM('ACTION', 'DELETED', 'REPORT_PENDING'),
            defaultValue: 'ACTION',
        },
        deleted_at: {
            type: DataTypes.DATE,
            allowNull: true,
        },        
    }, { 
        tableName: 'communities', 
        timestamps: true, // createdAt, updatedAt
        underscored: true, 
        indexes: [
            { name: 'communities_user_id_idx', fields: ['user_id'] },
        ],
    }); 
    
    community.associate = (models) => { 
        // Community (1 : N) User 
        community.belongsTo(models.user, { foreignKey: 'user_id', targetKey: 'id',onDelete: 'SET NULL',onUpdate: 'NO ACTION' }); 
        // Community (1 : N) comments 
        community.hasMany(models.comment, { foreignKey: 'community_id', sourceKey: 'id'}); 
        // 1:N - community : reports (신고)
        community.hasMany(models.report, { foreignKey: 'target_id', sourceKey: 'id', scope: { type: 'COMMUNITY' } });
    }; 
    
    return community; 

};