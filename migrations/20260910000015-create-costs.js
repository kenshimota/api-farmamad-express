"use strict";

const TABLE = "costs";
const PRODUCT_INDEX = "costs_product_id_idx";
const ITEM_STATE_INDEX = "costs_item_state_id_idx";
const UNIQUE_COMBINATION = "costs_product_id_item_state_id_unique";
const NON_NEGATIVE_CHECK = "costs_cost_non_negative";

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
      product_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      item_state_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      cost: {
        type: Sequelize.DECIMAL(12, 2),
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

    await queryInterface.addConstraint(TABLE, {
      fields: ["product_id"],
      type: "foreign key",
      name: "costs_product_id_fkey",
      references: { table: "products", field: "id" },
      onUpdate: "CASCADE",
      onDelete: "RESTRICT",
    });

    await queryInterface.addConstraint(TABLE, {
      fields: ["item_state_id"],
      type: "foreign key",
      name: "costs_item_state_id_fkey",
      references: { table: "item_states", field: "id" },
      onUpdate: "CASCADE",
      onDelete: "RESTRICT",
    });

    await queryInterface.addConstraint(TABLE, {
      fields: ["product_id", "item_state_id"],
      type: "unique",
      name: UNIQUE_COMBINATION,
    });

    await queryInterface.addConstraint(TABLE, {
      fields: ["cost"],
      type: "check",
      name: NON_NEGATIVE_CHECK,
      where: { cost: { [Sequelize.Op.gte]: 0 } },
    });

    await queryInterface.addIndex(TABLE, ["product_id"], {
      name: PRODUCT_INDEX,
    });
    await queryInterface.addIndex(TABLE, ["item_state_id"], {
      name: ITEM_STATE_INDEX,
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable(TABLE);
  },
};
