"use strict";

const TABLE = "currency_rate_history";
const CURRENCY_INDEX = "currency_rate_history_currency_id_idx";
const NEW_RATE_CHECK = "currency_rate_history_new_rate_positive";

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
      currency_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      previous_rate: {
        type: Sequelize.DECIMAL(18, 6),
        allowNull: true,
      },
      new_rate: {
        type: Sequelize.DECIMAL(18, 6),
        allowNull: false,
      },
      changed_by: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      changed_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
      reason: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
    });

    await queryInterface.addConstraint(TABLE, {
      fields: ["currency_id"],
      type: "foreign key",
      name: "currency_rate_history_currency_id_fkey",
      references: { table: "currencies", field: "id" },
      onUpdate: "CASCADE",
      onDelete: "RESTRICT",
    });

    await queryInterface.addConstraint(TABLE, {
      fields: ["changed_by"],
      type: "foreign key",
      name: "currency_rate_history_changed_by_fkey",
      references: { table: "users", field: "id" },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    });

    await queryInterface.addConstraint(TABLE, {
      fields: ["new_rate"],
      type: "check",
      name: NEW_RATE_CHECK,
      where: { new_rate: { [Sequelize.Op.gt]: 0 } },
    });

    await queryInterface.addIndex(TABLE, ["currency_id"], {
      name: CURRENCY_INDEX,
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable(TABLE);
  },
};
