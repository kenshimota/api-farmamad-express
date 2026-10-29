"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("images", {
      id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
      },
      url: {
        type: Sequelize.STRING(2048),
        allowNull: false,
      },
      pathname: {
        type: Sequelize.STRING(2048),
        allowNull: true,
        defaultValue: null,
      },
      reference: {
        type: Sequelize.STRING(100),
        allowNull: false,
        unique: true,
      },
      thumbnail: {
        type: Sequelize.STRING(2048),
        allowNull: false,
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("images");
  },
};
