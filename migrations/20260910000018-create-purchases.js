"use strict";

const TABLE = "purchases";
const SUPPLIER_INDEX = "purchases_supplier_id_idx";
const STATUS_INDEX = "purchases_status_idx";
const NUMBER_UNIQUE = "purchases_number_unique";
const STATUS_CHECK = "purchases_status_check";
const SUBTOTAL_CHECK = "purchases_subtotal_non_negative";
const TAX_RATE_CHECK = "purchases_tax_rate_range";
const TAX_AMOUNT_CHECK = "purchases_tax_amount_non_negative";
const TOTAL_CHECK = "purchases_total_non_negative";

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
      supplier_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      status: {
        type: Sequelize.STRING(20),
        allowNull: false,
        defaultValue: "draft",
      },
      subtotal: {
        type: Sequelize.DECIMAL(12, 2),
        allowNull: false,
        defaultValue: 0,
      },
      tax_rate: {
        type: Sequelize.DECIMAL(5, 2),
        allowNull: false,
        defaultValue: 16,
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
      notes: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      confirmed_at: {
        type: Sequelize.DATE,
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
      fields: ["supplier_id"],
      type: "foreign key",
      name: "purchases_supplier_id_fkey",
      references: { table: "suppliers", field: "id" },
      onUpdate: "CASCADE",
      onDelete: "RESTRICT",
    });

    await queryInterface.addConstraint(TABLE, {
      fields: ["number"],
      type: "unique",
      name: NUMBER_UNIQUE,
    });

    await queryInterface.addConstraint(TABLE, {
      fields: ["status"],
      type: "check",
      name: STATUS_CHECK,
      where: {
        status: { [Sequelize.Op.in]: ["draft", "confirmed", "cancelled"] },
      },
    });

    await queryInterface.addConstraint(TABLE, {
      fields: ["subtotal"],
      type: "check",
      name: SUBTOTAL_CHECK,
      where: { subtotal: { [Sequelize.Op.gte]: 0 } },
    });

    await queryInterface.addConstraint(TABLE, {
      fields: ["tax_rate"],
      type: "check",
      name: TAX_RATE_CHECK,
      where: { tax_rate: { [Sequelize.Op.between]: [0, 100] } },
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

    await queryInterface.addIndex(TABLE, ["supplier_id"], {
      name: SUPPLIER_INDEX,
    });
    await queryInterface.addIndex(TABLE, ["status"], {
      name: STATUS_INDEX,
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable(TABLE);
  },
};
