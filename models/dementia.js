// models/dementia.js

module.exports = (sequelize, DataTypes) => {
  const dementia = sequelize.define(
    "dementia",
    {
      // 1. 시간 지남력
      orientation_time: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: "시간 지남력 점수",
      },
      // 2. 장소 지남력
      orientation_place: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: "장소 지남력 점수",
      },
      // 3. 기억 등록
      registration: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: "기억 등록 점수",
      },
      // 4. 주의집중 및 계산
      attention_calculation: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: "주의집중 및 계산 점수",
      },
      // 5. 기억 회상
      recall: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: "기억 회상 점수",
      },
      // 6. 이름 대기
      naming: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: "사물 이름대기 점수",
      },
      // 7. 따라 말하기
      repetition: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: "따라 말하기 점수",
      },
      // 8. 명령 수행
      command: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: "3단계 명령 수행 점수",
      },
      // 9. 읽기
      reading: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: "읽기 수행 점수",
      },
      // 10. 쓰기
      writing: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: "문장 쓰기 점수",
      },
      // 11. 도형 모사
      copying: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: "도형 모사 점수",
      },
      // 12. 실행 능력 (praxis)
      praxis: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: "실행 능력 점수",
      },
      // 총점
      total_score: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: "MMSE 총점",
      },
    },
    {
      tableName: "dementia",
      timestamps: true,
      comment: "치매 인지기능 평가 결과 테이블",
      createdAt: "exam_date",
    }
  );

  dementia.associate = (models) => {
    dementia.belongsTo(models.user, { foreignKey: "user_id" });
  };

  return dementia;
};
