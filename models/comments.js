// 커뮤니티 댓글

module.exports = (sequelize, DataTypes) => {
    const comments = sequelize.define('comments', {
        id: { 
            type: DataTypes.INTEGER, 
            primaryKey: true, 
            autoIncrement: true 
        },
        userId: { // 댓글 작성자
            type: DataTypes.INTEGER, 
            allowNull: false,
            field: 'user_id',
        },
        communityId:{ // 게시글 id
            type: DataTypes.INTEGER,
            allowNull: false,
            field: 'community_id',
        },
        content: { // 댓글 내용
            type: DataTypes.TEXT, 
            allowNull: false 
        },
        parentId:{ // 대댓글 시 부모 댓글
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
    comments.associate = (models) => {
        // 댓글 작성자(user) 1:N 댓글(comments)
        comments.belongsTo(models.user, { foreignKey: 'user_id'});

        // 커뮤니티(community) 1 : N 댓글(comments)
        comments.belongsTo(models.community, { foreignKey: 'community_id'});

        // 부모 댓글(self-referencing)
        comments.belongsTo(models.comments, { foreignKey: 'parent_id', as: 'parentComment' });

        // 대댓글(self-referencing)
        comments.hasMany(models.comments, { foreignKey: 'parent_id', sourceKey: 'id', as: 'replies' });

    };


    return comments;
};
