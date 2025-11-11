module.exports = (sequelize, DataTypes) => {
  const ecommerce = sequelize.define(
    "ecommerce",
    {
      title: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: "제목",
      },
      link: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: "링크",
      },
      image: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: "이미지",
      },
      price: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: "가격",
      },
      category: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: "카테고리",
      },
    },
    {
      tableName: "ecommerces",
      comment: "요양기기",
      createdAt: "created_at",
      updatedAt: "updated_at",
    }
  );

  return ecommerce;
};
