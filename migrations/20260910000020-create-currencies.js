"use strict";

const TABLE = "currencies";
const RATE_CHECK = "currencies_rate_positive";
const CODE_INDEX = "currencies_code_lower_unique";
const BASE_INDEX = "currencies_base_unique";

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
        type: Sequelize.STRING(10),
        allowNull: false,
      },
      name: {
        type: Sequelize.STRING(100),
        allowNull: false,
      },
      symbol: {
        type: Sequelize.STRING(10),
        allowNull: false,
      },
      rate: {
        type: Sequelize.DECIMAL(18, 6),
        allowNull: false,
      },
      is_base: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
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
      where: { rate: { [Sequelize.Op.gt]: 0 } },
    });

    // The API stores codes in uppercase, but the database also rejects
    // duplicates that only differ in case.
    await queryInterface.addIndex(TABLE, [Sequelize.literal('LOWER("code")')], {
      unique: true,
      name: CODE_INDEX,
    });

    // Partial unique index: at most one row can be the base currency.
    await queryInterface.addIndex(TABLE, ["is_base"], {
      unique: true,
      where: { is_base: true },
      name: BASE_INDEX,
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable(TABLE);
  },
};
