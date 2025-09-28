// models/user_sns.js
module.exports = (sequelize, DataTypes) => {
    const user_sns = sequelize.define('user_sns', {
        id: { 
            type: DataTypes.INTEGER, 
            primaryKey: true, 
            autoIncrement: true 
        },
        user_id: { 
            type: DataTypes.INTEGER, 
            allowNull: false 
        },
        provider: { 
            type: DataTypes.STRING(50), 
            allowNull: false // 'naver', 'kakao', 'google'
        },
        sns_id: { 
            type: DataTypes.STRING(255), 
            allowNull: false 
        },
        refresh_token: { 
            type: DataTypes.STRING(255), 
            allowNull: true 
        },
        created_at: { 
            type: DataTypes.DATE, 
            defaultValue: DataTypes.NOW 
        },
        updated_at: { 
            type: DataTypes.DATE, 
            defaultValue: DataTypes.NOW 
        },
    }, {
        tableName: 'user_sns',
        timestamps: true,
        underscored: true,
        indexes: [ 
            {
                // 같은 sns 계정이 여러 유저에게 연결되는 것 방지
                unique: true,
                name: 'uq_user_sns_provider_snsid',   // DB 제약조건 이름과 맞춤
                fields: ['provider', 'sns_id'],
            },
            {
                // 한 유저가 같은 sns를 여러 계정으로 연결하는 것 방지
                unique: true,
                name: 'uq_user_sns_userid_provider', // DB 제약조건 이름과 맞춤
                fields: ['user_id', 'provider'],
            },
        ],
    });

    // associations
    user_sns.associate = (models) => {
        // user(사용자) 1 : N user_sns(sns 계정)
        user_sns.belongsTo(models.user, { foreignKey: 'user_id' });
    };

    return user_sns;
};
