"use strict";

const TABLE = "orders";
const NUMBER_UNIQUE = "orders_number_unique";
const STATUS_CHECK = "orders_status_check";
const SUBTOTAL_CHECK = "orders_subtotal_non_negative";
const TOTAL_CHECK = "orders_total_non_negative";
const NOTES_CHECK = "orders_notes_length_check";
const STATUSES = Object.freeze([
  "pending",
  "confirmed",
  "preparing",
  "shipped",
  "delivered",
  "cancelled",
]);
const FOREIGN_KEYS = Object.freeze([
  ["customer_id", "customers"],
  ["user_id", "users"],
  ["currency_id", "currencies"],
]);
const INDEXES = Object.freeze(["customer_id", "status", "createdAt"]);

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
      number: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      customer_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      user_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      currency_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      status: {
        type: Sequelize.STRING(20),
        allowNull: false,
        defaultValue: "pending",
      },
      subtotal: {
        type: Sequelize.DECIMAL(12, 2),
        allowNull: false,
      },
      total: {
        type: Sequelize.DECIMAL(12, 2),
        allowNull: false,
      },
      delivery_address: {
        type: Sequelize.STRING(500),
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

    for (const [field, table] of FOREIGN_KEYS) {
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
      fields: ["number"],
      type: "unique",
      name: NUMBER_UNIQUE,
    });

    await queryInterface.addConstraint(TABLE, {
      fields: ["status"],
      type: "check",
      name: STATUS_CHECK,
      where: { status: { [Sequelize.Op.in]: [...STATUSES] } },
    });

    await queryInterface.addConstraint(TABLE, {
      fields: ["subtotal"],
      type: "check",
      name: SUBTOTAL_CHECK,
      where: { subtotal: { [Sequelize.Op.gte]: 0 } },
    });

    await queryInterface.addConstraint(TABLE, {
      fields: ["total"],
      type: "check",
      name: TOTAL_CHECK,
      where: { total: { [Sequelize.Op.gte]: 0 } },
    });

    await queryInterface.addConstraint(TABLE, {
      fields: ["notes"],
      type: "check",
      name: NOTES_CHECK,
      where: Sequelize.literal("char_length(notes) <= 1000"),
    });

    for (const column of INDEXES) {
      await queryInterface.addIndex(TABLE, [column], {
        name: `orders_${column}_idx`,
      });
    }
  },

  async down(queryInterface) {
    await queryInterface.dropTable(TABLE);
  },
};
