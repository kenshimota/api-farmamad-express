"use strict";

const TABLE = "method_payment_types";
const CODE_INDEX = "method_payment_types_code_lower_unique";
const CURRENCY_INDEX = "method_payment_types_currency_id_idx";

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
      currency_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      fields: {
        type: Sequelize.JSONB,
        allowNull: false,
        defaultValue: [],
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
      fields: ["currency_id"],
      type: "foreign key",
      name: `${TABLE}_currency_id_fkey`,
      references: { table: "currencies", field: "id" },
      onUpdate: "CASCADE",
      onDelete: "RESTRICT",
    });

    // Codes are stored uppercase, but the database also rejects duplicates
    // that only differ in case.
    await queryInterface.addIndex(TABLE, [Sequelize.literal('LOWER("code")')], {
      unique: true,
      name: CODE_INDEX,
    });

    await queryInterface.addIndex(TABLE, ["currency_id"], {
      name: CURRENCY_INDEX,
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable(TABLE);
  },
};
