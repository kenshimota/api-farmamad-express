"use strict";

const TABLE = "payment_terms";
const CODE_UNIQUE = "payment_terms_code_unique";
const CODE_FORMAT = "payment_terms_code_format";
const DAYS_RANGE = "payment_terms_days_range";

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
        type: Sequelize.STRING(30),
        allowNull: false,
      },
      name: {
        type: Sequelize.STRING(100),
        allowNull: false,
      },
      description: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      days: {
        type: Sequelize.INTEGER,
        allowNull: false,
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

    // Codes are stable keys and the API normalizes them to lowercase; the
    // functional index keeps them unique ignoring case even if a row is
    // written outside the API.
    await queryInterface.addIndex(TABLE, [Sequelize.literal('LOWER("code")')], {
      unique: true,
      name: CODE_UNIQUE,
    });

    await queryInterface.addConstraint(TABLE, {
      fields: ["code"],
      type: "check",
      name: CODE_FORMAT,
      where: Sequelize.literal("code ~ '^[a-z][a-z0-9_]{1,29}$'"),
    });

    await queryInterface.addConstraint(TABLE, {
      fields: ["days"],
      type: "check",
      name: DAYS_RANGE,
      where: { days: { [Sequelize.Op.between]: [0, 3650] } },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable(TABLE);
  },
};
