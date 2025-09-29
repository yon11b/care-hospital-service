module.exports = (sequelize, DataTypes) => { 
    const reports = sequelize.define('reports', { 
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      type: { // type 컬럼으로 리뷰, 커뮤니티, 댓글 신고 구분
        type: DataTypes.STRING(20),
        allowNull: false,
      },
      target_id: { // 신고 대상의 id
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      user_id: { // 신고자
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      category: { // 신고 이유 카테고리
        type: DataTypes.ENUM(
          'DUPLICATE_SPAM',   // 중복/도배성
          'AD_PROMOTION',     // 광고/홍보성
          'ABUSE_HATE',       // 욕설/비방/혐오
          'PRIVACY_LEAK',     // 개인정보 노출/유포
          'SEXUAL_CONTENT',   // 음란/선정성
          'ETC'               // 기타
        ),
        allowNull: false,
      },
      reason: { // 신고 이유 작성(선택)
        type: DataTypes.TEXT,
        allowNull: true,
      },
      status: { // 신고 처리 상태 - 접수, 승인, 거절
        type: DataTypes.ENUM('PENDING', 'APPROVED', 'REJECTED'),
        defaultValue: 'PENDING',
      },
      created_at: { // 신고일
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
      },
      updated_at: { // 수정일
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
      }, 
      resolved_at: { // 신고 처리일
        type: DataTypes.DATE,
        allowNull: true,
      },
    },
    {
      tableName: 'reports',
      timestamps: true,
      underscored: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
      indexes: [
        {
          unique: true,
          fields: ['user_id', 'type', 'target_id'], // 한 유저의 중복 신고 방지
        },
      ],
    }
  );
    
    reports.associate = (models) => { 
        // reports (N : 1) user 
        reports.belongsTo(models.user, { foreignKey: 'user_id', targetKey: 'id', onDelete: 'SET NULL', onUpdate: 'NO ACTION'}); 
        // reviews 신고 연동 (1:N)
        reports.belongsTo(models.reviews, { foreignKey: 'target_id', constraints: false }); 
    }; 
    
    return reports; 

};