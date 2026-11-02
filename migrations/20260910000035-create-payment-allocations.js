"use strict";

const TABLE = "payment_allocations";
const UNIQUE_ALLOCATION = "payment_allocations_payment_invoice_unique";
const AMOUNT_CHECK = "payment_allocations_amount_positive";
const APPLIED_AMOUNT_CHECK = "payment_allocations_applied_amount_positive";
const EXCHANGE_RATE_CHECK = "payment_allocations_exchange_rate_positive";

/**
 * Creates the immutable allocation of one received payment to one invoice.
 *
 * `amount` is debited from the customer wallet in the payment currency while
 * `applied_amount` is credited to the invoice in the invoice currency. The
 * unique `(payment_id, invoice_id)` pair prevents applying the same payment to
 * the same invoice twice. There are no endpoints to edit or delete a row.
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
      payment_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      invoice_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      amount: {
        type: Sequelize.DECIMAL(14, 2),
        allowNull: false,
      },
      applied_amount: {
        type: Sequelize.DECIMAL(12, 2),
        allowNull: false,
      },
      exchange_rate: {
        type: Sequelize.DECIMAL(18, 6),
        allowNull: false,
      },
      allocated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
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
      ["payment_id", "payments"],
      ["invoice_id", "invoices"],
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
      fields: ["payment_id", "invoice_id"],
      type: "unique",
      name: UNIQUE_ALLOCATION,
    });

    for (const [field, name] of [
      ["amount", AMOUNT_CHECK],
      ["applied_amount", APPLIED_AMOUNT_CHECK],
      ["exchange_rate", EXCHANGE_RATE_CHECK],
    ]) {
      await queryInterface.addConstraint(TABLE, {
        fields: [field],
        type: "check",
        name,
        where: { [field]: { [Sequelize.Op.gt]: 0 } },
      });
    }

    await queryInterface.addIndex(TABLE, ["payment_id"], {
      name: `${TABLE}_payment_id_idx`,
    });
    await queryInterface.addIndex(TABLE, ["invoice_id"], {
      name: `${TABLE}_invoice_id_idx`,
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable(TABLE);
  },
};
