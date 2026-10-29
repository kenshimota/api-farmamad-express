"use strict";

const TABLE = "purchase_items";
const PURCHASE_INDEX = "purchase_items_purchase_id_idx";
const PRODUCT_INDEX = "purchase_items_product_id_idx";
const ITEM_STATE_INDEX = "purchase_items_item_state_id_idx";
const UNIQUE_COMBINATION = "purchase_items_purchase_product_state_unique";
const QUANTITY_CHECK = "purchase_items_quantity_positive";
const UNIT_COST_CHECK = "purchase_items_unit_cost_non_negative";
const SUBTOTAL_CHECK = "purchase_items_subtotal_non_negative";

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
      purchase_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      product_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      item_state_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      quantity: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      unit_cost: {
        type: Sequelize.DECIMAL(12, 2),
        allowNull: false,
      },
      subtotal: {
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
      fields: ["purchase_id"],
      type: "foreign key",
      name: "purchase_items_purchase_id_fkey",
      references: { table: "purchases", field: "id" },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    });

    await queryInterface.addConstraint(TABLE, {
      fields: ["product_id"],
      type: "foreign key",
      name: "purchase_items_product_id_fkey",
      references: { table: "products", field: "id" },
      onUpdate: "CASCADE",
      onDelete: "RESTRICT",
    });

    await queryInterface.addConstraint(TABLE, {
      fields: ["item_state_id"],
      type: "foreign key",
      name: "purchase_items_item_state_id_fkey",
      references: { table: "item_states", field: "id" },
      onUpdate: "CASCADE",
      onDelete: "RESTRICT",
    });

    await queryInterface.addConstraint(TABLE, {
      fields: ["purchase_id", "product_id", "item_state_id"],
      type: "unique",
      name: UNIQUE_COMBINATION,
    });

    await queryInterface.addConstraint(TABLE, {
      fields: ["quantity"],
      type: "check",
      name: QUANTITY_CHECK,
      where: { quantity: { [Sequelize.Op.gt]: 0 } },
    });

    await queryInterface.addConstraint(TABLE, {
      fields: ["unit_cost"],
      type: "check",
      name: UNIT_COST_CHECK,
      where: { unit_cost: { [Sequelize.Op.gte]: 0 } },
    });

    await queryInterface.addConstraint(TABLE, {
      fields: ["subtotal"],
      type: "check",
      name: SUBTOTAL_CHECK,
      where: { subtotal: { [Sequelize.Op.gte]: 0 } },
    });

    await queryInterface.addIndex(TABLE, ["purchase_id"], {
      name: PURCHASE_INDEX,
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
