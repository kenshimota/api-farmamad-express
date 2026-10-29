"use strict";

const TABLE = "taxes";
const RATE_CHECK = "taxes_rate_range";
const CODE_INDEX = "taxes_code_lower_unique";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable(TABLE, {
      id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
      },
      code: {
        type: Sequelize.STRING(20),
        allowNull: false,
      },
      name: {
        type: Sequelize.STRING(100),
        allowNull: false,
      },
      rate: {
        type: Sequelize.DECIMAL(5, 2),
        allowNull: false,
      },
      description: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      is_active: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
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

    await queryInterface.addConstraint(TABLE, {
      fields: ["rate"],
      type: "check",
      name: RATE_CHECK,
      where: { rate: { [Sequelize.Op.between]: [0, 100] } },
    });

    // The API stores codes in uppercase, but the database also rejects
    // duplicates that only differ in case.
    await queryInterface.addIndex(TABLE, [Sequelize.literal('LOWER("code")')], {
      unique: true,
      name: CODE_INDEX,
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable(TABLE);
  },
};
