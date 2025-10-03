module.exports = (sequelize, DataTypes) => { 
    const reservation = sequelize.define('reservation', { 
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
        },
        facility_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },
        user_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },
        patient_name: {
            type: DataTypes.STRING(100),
            allowNull: true,
        },
        patient_phone: {
            type: DataTypes.STRING(20),
            allowNull: true,
        },
        patient_birth: {
            type: DataTypes.DATEONLY,
            allowNull: true,
        },
        patient_gender: {
            type: DataTypes.ENUM('M', 'F'), // gender_enum
            allowNull: true,
        },
        disease_type: {
            type: DataTypes.ENUM('치매','재활','파킨슨','뇌혈관성질환','중풍','암','기타'), // disease_enum
            allowNull: false,
        },
        reserved_date: {
            type: DataTypes.DATEONLY,
            allowNull: false,
        },
        reserved_time: {
            type: DataTypes.TIME,
            allowNull: false,
        },
        status: {
            type: DataTypes.ENUM('PENDING','CONFIRMED','CANCELED','REJECTED'), // reservation_status_enum
            allowNull: false,
            defaultValue: 'PENDING',
        },
        notes: {
            type: DataTypes.TEXT,
            allowNull: true,
        },
    }, {
        tableName: 'reservations',
        timestamps: true,
        underscored: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',        
    });
    
    reservation.associate = (models) => { 
      reservation.belongsTo(models.user, { foreignKey: 'user_id', onUpdate: 'NO ACTION', onDelete: 'NO ACTION'});
      reservation.belongsTo(models.facility, { foreignKey: 'facility_id', onUpdate: 'NO ACTION', onDelete: 'NO ACTION' });    
    
    };

    return reservation; 
};