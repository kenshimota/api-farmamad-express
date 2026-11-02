"use strict";

const TABLE = "order_items";
const UNIQUE_COMBINATION = "order_items_order_product_state_unique";
const QUANTITY_CHECK = "order_items_quantity_positive";
const UNIT_PRICE_CHECK = "order_items_unit_price_non_negative";
const SUBTOTAL_CHECK = "order_items_subtotal_non_negative";
const FOREIGN_KEYS = Object.freeze([
  ["order_id", "orders", "CASCADE"],
  ["product_id", "products", "RESTRICT"],
  ["item_state_id", "item_states", "RESTRICT"],
]);
const INDEXES = Object.freeze(["order_id", "product_id", "item_state_id"]);

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
      order_id: {
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
      unit_price: {
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

    for (const [field, table, onDelete] of FOREIGN_KEYS) {
      await queryInterface.addConstraint(TABLE, {
        fields: [field],
        type: "foreign key",
        name: `${TABLE}_${field}_fkey`,
        references: { table, field: "id" },
        onUpdate: "CASCADE",
        onDelete,
      });
    }

    await queryInterface.addConstraint(TABLE, {
      fields: ["order_id", "product_id", "item_state_id"],
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
      fields: ["unit_price"],
      type: "check",
      name: UNIT_PRICE_CHECK,
      where: { unit_price: { [Sequelize.Op.gte]: 0 } },
    });

    await queryInterface.addConstraint(TABLE, {
      fields: ["subtotal"],
      type: "check",
      name: SUBTOTAL_CHECK,
      where: { subtotal: { [Sequelize.Op.gte]: 0 } },
    });

    for (const column of INDEXES) {
      await queryInterface.addIndex(TABLE, [column], {
        name: `${TABLE}_${column}_idx`,
      });
    }
  },

  async down(queryInterface) {
    await queryInterface.dropTable(TABLE);
  },
};
