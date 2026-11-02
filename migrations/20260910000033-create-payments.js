"use strict";

const TABLE = "payments";
const AMOUNT_CHECK = "payments_amount_positive";
const INDEXES = Object.freeze([
  { fields: ["customer_id"], name: "payments_customer_id_idx" },
  { fields: ["method_payment_id"], name: "payments_method_payment_id_idx" },
  { fields: ["currency_id"], name: "payments_currency_id_idx" },
  { fields: ["paid_at"], name: "payments_paid_at_idx" },
]);

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
      customer_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      method_payment_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      currency_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      amount: {
        type: Sequelize.DECIMAL(14, 2),
        allowNull: false,
      },
      paid_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
      reference: {
        type: Sequelize.STRING(100),
        allowNull: true,
      },
      notes: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      created_by_user_id: {
        type: Sequelize.INTEGER,
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

    for (const [field, table] of [
      ["customer_id", "customers"],
      ["method_payment_id", "method_payments"],
      ["currency_id", "currencies"],
      ["created_by_user_id", "users"],
    ]) {
      await queryInterface.addConstraint(TABLE, {
        fields: [field],
        type: "foreign key",
        name: `${TABLE}_${field}_fkey`,
        references: { table, field: "id" },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT",
      });
    }

    await queryInterface.addConstraint(TABLE, {
      fields: ["amount"],
      type: "check",
      name: AMOUNT_CHECK,
      where: { amount: { [Sequelize.Op.gt]: 0 } },
    });

    for (const index of INDEXES) {
      await queryInterface.addIndex(TABLE, index.fields, {
        name: index.name,
      });
    }
  },

  async down(queryInterface) {
    await queryInterface.dropTable(TABLE);
  },
};
