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
        type: DataTypes.DATE,
        allowNull: false,
        comment: '기관 전화번호',
      },
      currentPatients: {
        type: DataTypes.DATE,
        allowNull: false,
        comment: '전체 환자 수',
      },
      manPatients: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: '남성 환자 수',
      },
      womanPatients: {
        type: DataTypes.DATE,
        allowNull: false,
        comment: '여성 환자 수',
      },
      description: {
        type: DataTypes.DATE,
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
      sidoName: {
        type: DataTypes.BOOLEAN,
        allowNull: true,
        comment: '시,도 이름',
      },
      sgguName: {
        type: DataTypes.DATE,
        allowNull: false,
        comment: '시군구 이름',
      },
      dongName: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: '동 이름',
      },
      postno: {
        type: DataTypes.DATE,
        allowNull: false,
        comment: '우편번호',
      },
      establishedDate: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: '기관설립날짜',
      },
      totalDoctorCount: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: '전체 의사 수',
      },
      xPos: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: 'x 좌표 위치',
      },
      yPos: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: 'y 좌표 위치',
      },
      primaryCode: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: '요양기호',
      },
      userCapacity: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: '수용 가능 인원',
      },
      totalManagerCount: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: '전체 복지사 수',
      },
    },
    {
      tableName: 'facility',
      comment: '기관',
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
