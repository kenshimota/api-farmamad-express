"use strict";

const TABLE = "invoices";
const NUMBER_UNIQUE = "invoices_number_unique";
const ORDER_UNIQUE = "invoices_order_id_unique";
const STATUS_CHECK = "invoices_payment_status_check";
const SUBTOTAL_CHECK = "invoices_subtotal_non_negative";
const TAX_AMOUNT_CHECK = "invoices_tax_amount_non_negative";
const TOTAL_CHECK = "invoices_total_non_negative";
const PAID_AMOUNT_CHECK = "invoices_paid_amount_non_negative";
const NOTES_CHECK = "invoices_notes_length_check";

/**
 * Migration for the immutable invoice header.
 *
 * `order_id` and `payment_term_id` stay nullable and without a foreign key in
 * this branch because `orders` (HU-34/#58, HU-39/#63) and `payment_terms`
 * (HU-41/#65) do not exist yet. Once those tables exist a follow-up migration
 * must add the `orders.id` and `payment_terms.id` constraints and the columns
 * can become required. The unique index on `order_id` already enforces one
 * invoice per order as soon as the column is populated.
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
      number: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      // TODO(HU-40/#58,#63): nullable until the `orders` table exists; then
      // make it NOT NULL and add the `orders.id` foreign key.
      order_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      customer_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      invoiced_by_user_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      currency_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      // TODO(HU-40/#65): nullable until the `payment_terms` table exists; then
      // make it NOT NULL and add the `payment_terms.id` foreign key.
      payment_term_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      subtotal: {
        type: Sequelize.DECIMAL(12, 2),
        allowNull: false,
        defaultValue: 0,
      },
      tax_amount: {
        type: Sequelize.DECIMAL(12, 2),
        allowNull: false,
        defaultValue: 0,
      },
      total: {
        type: Sequelize.DECIMAL(12, 2),
        allowNull: false,
        defaultValue: 0,
      },
      paid_amount: {
        type: Sequelize.DECIMAL(12, 2),
        allowNull: false,
        defaultValue: 0,
      },
      payment_status: {
        type: Sequelize.STRING(20),
        allowNull: false,
        defaultValue: "pending",
      },
      issued_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
      due_date: {
        type: Sequelize.DATEONLY,
        allowNull: false,
      },
      notes: {
        type: Sequelize.TEXT,
        allowNull: true,
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
      fields: ["number"],
      type: "unique",
      name: NUMBER_UNIQUE,
    });

    await queryInterface.addConstraint(TABLE, {
      fields: ["order_id"],
      type: "unique",
      name: ORDER_UNIQUE,
    });

    await queryInterface.addConstraint(TABLE, {
      fields: ["customer_id"],
      type: "foreign key",
      name: "invoices_customer_id_fkey",
      references: { table: "customers", field: "id" },
      onUpdate: "CASCADE",
      onDelete: "RESTRICT",
    });

    await queryInterface.addConstraint(TABLE, {
      fields: ["invoiced_by_user_id"],
      type: "foreign key",
      name: "invoices_invoiced_by_user_id_fkey",
      references: { table: "users", field: "id" },
      onUpdate: "CASCADE",
      onDelete: "RESTRICT",
    });

    await queryInterface.addConstraint(TABLE, {
      fields: ["currency_id"],
      type: "foreign key",
      name: "invoices_currency_id_fkey",
      references: { table: "currencies", field: "id" },
      onUpdate: "CASCADE",
      onDelete: "RESTRICT",
    });

    await queryInterface.addConstraint(TABLE, {
      fields: ["payment_status"],
      type: "check",
      name: STATUS_CHECK,
      where: {
        payment_status: {
          [Sequelize.Op.in]: ["pending", "partial", "paid"],
        },
      },
    });

    await queryInterface.addConstraint(TABLE, {
      fields: ["subtotal"],
      type: "check",
      name: SUBTOTAL_CHECK,
      where: { subtotal: { [Sequelize.Op.gte]: 0 } },
    });

    await queryInterface.addConstraint(TABLE, {
      fields: ["tax_amount"],
      type: "check",
      name: TAX_AMOUNT_CHECK,
      where: { tax_amount: { [Sequelize.Op.gte]: 0 } },
    });

    await queryInterface.addConstraint(TABLE, {
      fields: ["total"],
      type: "check",
      name: TOTAL_CHECK,
      where: { total: { [Sequelize.Op.gte]: 0 } },
    });

    await queryInterface.addConstraint(TABLE, {
      fields: ["paid_amount"],
      type: "check",
      name: PAID_AMOUNT_CHECK,
      where: { paid_amount: { [Sequelize.Op.gte]: 0 } },
    });

    await queryInterface.addConstraint(TABLE, {
      fields: ["notes"],
      type: "check",
      name: NOTES_CHECK,
      where: Sequelize.literal("char_length(notes) <= 1000"),
    });

    await queryInterface.addIndex(TABLE, ["customer_id"], {
      name: "invoices_customer_id_idx",
    });
    await queryInterface.addIndex(TABLE, ["invoiced_by_user_id"], {
      name: "invoices_invoiced_by_user_id_idx",
    });
    await queryInterface.addIndex(TABLE, ["payment_term_id"], {
      name: "invoices_payment_term_id_idx",
    });
    await queryInterface.addIndex(TABLE, ["issued_at"], {
      name: "invoices_issued_at_idx",
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable(TABLE);
  },
};
