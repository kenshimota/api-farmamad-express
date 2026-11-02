"use strict";

const TABLE = "wallet_transactions";
const TYPE_CHECK = "wallet_transactions_type_check";
const AMOUNT_CHECK = "wallet_transactions_amount_non_zero";
const BALANCE_CHECK = "wallet_transactions_balance_after_non_negative";
const WALLET_INDEX = "wallet_transactions_wallet_created_idx";

/**
 * Creates the append-only wallet movement table. `invoice_id` and
 * `payment_allocation_id` are intentionally nullable and have no foreign key
 * yet: the invoices module belongs to HU-40/HU-43 and does not exist in this
 * branch. The service enforces the conditional requirements until the tables
 * and their RESTRICT foreign keys are added by those issues.
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
      wallet_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      transaction_type: {
        type: Sequelize.STRING(20),
        allowNull: false,
      },
      amount: {
        type: Sequelize.DECIMAL(14, 2),
        allowNull: false,
      },
      balance_after: {
        type: Sequelize.DECIMAL(14, 2),
        allowNull: false,
      },
      payment_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      // TODO(HU-40/HU-43): add the RESTRICT foreign key to invoices.id once
      // the invoices table exists.
      invoice_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      // TODO(HU-43): add the foreign key to payment_allocations.id once that
      // table exists.
      payment_allocation_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      description: {
        type: Sequelize.STRING(255),
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

    await queryInterface.addConstraint(TABLE, {
      fields: ["wallet_id"],
      type: "foreign key",
      name: `${TABLE}_wallet_id_fkey`,
      references: { table: "customer_wallets", field: "id" },
      onUpdate: "CASCADE",
      onDelete: "RESTRICT",
    });

    await queryInterface.addConstraint(TABLE, {
      fields: ["payment_id"],
      type: "foreign key",
      name: `${TABLE}_payment_id_fkey`,
      references: { table: "payments", field: "id" },
      onUpdate: "CASCADE",
      onDelete: "RESTRICT",
    });

    await queryInterface.addConstraint(TABLE, {
      fields: ["created_by_user_id"],
      type: "foreign key",
      name: `${TABLE}_created_by_user_id_fkey`,
      references: { table: "users", field: "id" },
      onUpdate: "CASCADE",
      onDelete: "RESTRICT",
    });

    await queryInterface.addConstraint(TABLE, {
      fields: ["transaction_type"],
      type: "check",
      name: TYPE_CHECK,
      where: {
        transaction_type: {
          [Sequelize.Op.in]: ["deposit", "invoice_payment"],
        },
      },
    });

    await queryInterface.addConstraint(TABLE, {
      fields: ["amount"],
      type: "check",
      name: AMOUNT_CHECK,
      where: { amount: { [Sequelize.Op.ne]: 0 } },
    });

    await queryInterface.addConstraint(TABLE, {
      fields: ["balance_after"],
      type: "check",
      name: BALANCE_CHECK,
      where: { balance_after: { [Sequelize.Op.gte]: 0 } },
    });

    await queryInterface.addIndex(TABLE, ["wallet_id", "createdAt", "id"], {
      name: WALLET_INDEX,
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable(TABLE);
  },
};
