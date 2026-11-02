"use strict";

const TABLE = "invoice_items";
const UNIQUE_LINE = "invoice_items_invoice_order_item_unique";
const QUANTITY_CHECK = "invoice_items_quantity_positive";
const UNIT_PRICE_CHECK = "invoice_items_unit_price_non_negative";
const SUBTOTAL_CHECK = "invoice_items_subtotal_non_negative";

/**
 * Migration for the immutable invoice line snapshots.
 *
 * `order_item_id` stays nullable and without a foreign key until `order_items`
 * exists (HU-34/#58). The unique `(invoice_id, order_item_id)` constraint still
 * prevents duplicating an order line in the same invoice.
 *
 * @type {import('sequelize-cli').Migration}
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable(TABLE, {
      id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
      },
      invoice_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      // TODO(HU-40/#58): nullable until `order_items` exists; then make it
      // NOT NULL and add the `order_items.id` foreign key.
      order_item_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      product_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      item_state_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      product_name: {
        type: Sequelize.STRING(150),
        allowNull: false,
      },
      product_reference: {
        type: Sequelize.STRING(100),
        allowNull: false,
      },
      item_state_name: {
        type: Sequelize.STRING(50),
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

    await queryInterface.addConstraint(TABLE, {
      fields: ["invoice_id"],
      type: "foreign key",
      name: "invoice_items_invoice_id_fkey",
      references: { table: "invoices", field: "id" },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    });

    await queryInterface.addConstraint(TABLE, {
      fields: ["product_id"],
      type: "foreign key",
      name: "invoice_items_product_id_fkey",
      references: { table: "products", field: "id" },
      onUpdate: "CASCADE",
      onDelete: "RESTRICT",
    });

    await queryInterface.addConstraint(TABLE, {
      fields: ["item_state_id"],
      type: "foreign key",
      name: "invoice_items_item_state_id_fkey",
      references: { table: "item_states", field: "id" },
      onUpdate: "CASCADE",
      onDelete: "RESTRICT",
    });

    await queryInterface.addConstraint(TABLE, {
      fields: ["invoice_id", "order_item_id"],
      type: "unique",
      name: UNIQUE_LINE,
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

    await queryInterface.addIndex(TABLE, ["invoice_id"], {
      name: "invoice_items_invoice_id_idx",
    });
    await queryInterface.addIndex(TABLE, ["product_id"], {
      name: "invoice_items_product_id_idx",
    });
    await queryInterface.addIndex(TABLE, ["item_state_id"], {
      name: "invoice_items_item_state_id_idx",
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable(TABLE);
  },
};
