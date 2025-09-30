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
            allowNull: false,
            field: 'user_id',
        },
        community_id:{ // 게시글 id
            type: DataTypes.INTEGER,
            allowNull: false,
            field: 'community_id',
        },
        content: { // 댓글 내용
            type: DataTypes.TEXT, 
            allowNull: false 
        },
        parent_id:{ // 대댓글 시 부모 댓글
            type : DataTypes.INTEGER,
            allowNull : true,
            field:'parent_id',
        },
    }, {
        timestamps: true,
        tableName: 'comments',
        underscored: true, // created_at, updated_at 자동 매핑
    });

    //Foreign keys
    comment.associate = (models) => {
        // 댓글 작성자(user) 1:N 댓글(comments)
        comment.belongsTo(models.user, { foreignKey: 'user_id'});

        // 커뮤니티(community) 1 : N 댓글(comments)
        comment.belongsTo(models.community, { foreignKey: 'community_id'});

        // 부모 댓글(self-referencing)
        comment.belongsTo(models.comment, { foreignKey: 'parent_id', as: 'parentComment', onDelete: 'CASCADE' });

        // 대댓글(self-referencing)
        comment.hasMany(models.comment, { foreignKey: 'parent_id', sourceKey: 'id', as: 'replies', onDelete: 'CASCADE' });

    };


    return comment;
};
