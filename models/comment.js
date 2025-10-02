// 커뮤니티 댓글

module.exports = (sequelize, DataTypes) => {
    const comment = sequelize.define('comment', {
        id: { 
            type: DataTypes.INTEGER, 
            primaryKey: true, 
            autoIncrement: true 
        },
        user_id: { // 댓글 작성자
            type: DataTypes.INTEGER, 
            allowNull: true
        },
        community_id:{ // 게시글 id
            type: DataTypes.INTEGER,
            allowNull: true
        },
        content: { // 댓글 내용
            type: DataTypes.TEXT, 
            allowNull: false 
        },
        parent_id:{ // 대댓글 시 부모 댓글
            type : DataTypes.INTEGER,
            allowNull : true,
        },
        status: {
            type: DataTypes.ENUM('ACTION', 'DELETED', 'REPORT_PENDING'),
            defaultValue: 'ACTION',
        },
        deleted_at: { 
            type: DataTypes.DATE, 
            allowNull: true 
        },        
    }, {
        timestamps: true,
        tableName: 'comments',
        underscored: true, // created_at, updated_at 자동 매핑
        indexes: [
            { name: 'idx_comments_user_id', fields: ['user_id'] },
            { name: 'idx_comments_community_id', fields: ['community_id'] },
            { name: 'idx_comments_parent_id', fields: ['parent_id'] },
        ],
    });

    //Foreign keys
    comment.associate = (models) => {
        // 댓글 작성자(user) 1:N 댓글(comments)
        comment.belongsTo(models.user, { foreignKey: 'user_id', targetKey: 'id', onDelete: 'SET NULL',onUpdate: 'NO ACTION' });
        // 커뮤니티(community) 1 : N 댓글(comments)
        comment.belongsTo(models.community, { foreignKey: 'community_id', targetKey: 'id', onDelete: 'SET NULL',onUpdate: 'NO ACTION'});
        // 부모 댓글(self-referencing)
        comment.belongsTo(models.comment, { foreignKey: 'parent_id', as: 'parentComment', onDelete: 'SET NULL',onUpdate: 'NO ACTION' });
        // 대댓글(self-referencing)
        comment.hasMany(models.comment, { foreignKey: 'parent_id', sourceKey: 'id', as: 'replies' });
        // 1:N - comment : reports (신고)
        comment.hasMany(models.report, { foreignKey: 'target_id', sourceKey: 'id', scope: { type: 'COMMENT' } });
   };


    return comment;
};