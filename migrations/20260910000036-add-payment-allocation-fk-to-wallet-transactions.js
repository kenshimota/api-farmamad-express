"use strict";

const TABLE = "wallet_transactions";
const CONSTRAINT = "wallet_transactions_payment_allocation_id_fkey";
const UNIQUE_INDEX = "wallet_transactions_payment_allocation_unique";

/**
 * Links each `invoice_payment` movement to the allocation that produced it.
 * The RESTRICT foreign key keeps the append-only history immutable and the
 * unique index guarantees exactly one movement per allocation; PostgreSQL does
 * not consider multiple `null` values duplicates, so deposits stay unaffected.
 *
 * @type {import('sequelize-cli').Migration}
 */
module.exports = {
  async up(queryInterface) {
    await queryInterface.addConstraint(TABLE, {
      fields: ["payment_allocation_id"],
      type: "foreign key",
      name: CONSTRAINT,
      references: { table: "payment_allocations", field: "id" },
      onUpdate: "CASCADE",
      onDelete: "RESTRICT",
    });

    await queryInterface.addIndex(TABLE, ["payment_allocation_id"], {
      unique: true,
      name: UNIQUE_INDEX,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex(TABLE, UNIQUE_INDEX);
    await queryInterface.removeConstraint(TABLE, CONSTRAINT);
  },
};
