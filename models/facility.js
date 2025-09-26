module.exports = (sequelize, DataTypes) => {
  const facility = sequelize.define(
    'facility',
    {
      kind: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: '기관분류',
      },
      name: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: '기관이름',
      },
      address: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: '기관주소',
      },
      telno: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: '기관 전화번호',
      },
      current_patients: {
        type: DataTypes.INTEGER,
        allowNull: false,
        comment: '전체 환자 수',
      },
      man_patients: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: '남성 환자 수',
      },
      woman_patients: {
        type: DataTypes.INTEGER,
        allowNull: false,
        comment: '여성 환자 수',
      },
      description: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: '병원 설명',
      },
      status: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: '기관등록승인상태',
      },
      url: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: '기관사이트',
      },
      sido_name: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: '시,도 이름',
      },
      sggu_name: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: '시군구 이름',
      },
      dong_name: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: '동 이름',
      },
      postno: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: '우편번호',
      },
      established_date: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: '기관설립날짜',
      },
      total_doctor_count: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: '전체 의사 수',
      },
      longitude: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: 'x 좌표 위치',
      },
      latitude: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: 'y 좌표 위치',
      },
      primary_code: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: '요양기호',
      },
      user_capacity: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: '수용 가능 인원',
      },
      total_manager_count: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: '전체 복지사 수',
      },
      today_meal: {
        type: DataTypes.JSONB,
        allowNull: true,
        comment: '오늘의 급식',
      },
      today_meal_url: {
        type: DataTypes.JSONB,
        allowNull: true,
        comment: '오늘의 급식 사진',
      },
    },
    {
      tableName: 'facility',
      comment: '기관',
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    },
  );

  //Foreign keys
  // facility.associate = models => {
  //   facility.hasMany(models.staff, { foreignKey: 'facilityId' });
  //   facility.hasMany(models.reviews, { foreignKey: 'facilityId' });
  //   facility.hasMany(models.reservation, { foreignKey: 'facilityId' });
  //   facility.hasMany(models.consult, { foreignKey: 'facilityId' });
  //   facility.hasMany(models.likes, { foreignKey: 'facilityId' });
  // };

  return facility;
};