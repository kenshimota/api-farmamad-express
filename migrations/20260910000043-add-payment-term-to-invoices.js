"use strict";

const TABLE = "invoices";
const COLUMN = "payment_term_id";
const FOREIGN_KEY = "invoices_payment_term_id_fkey";

/**
 * Completes the invoice payment snapshot created by HU-40: the column already
 * exists (nullable and indexed) because `payment_terms` did not exist yet.
 * This migration adds the foreign key and makes the term required.
 * @type {import('sequelize-cli').Migration}
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addConstraint(TABLE, {
      fields: [COLUMN],
      type: "foreign key",
      name: FOREIGN_KEY,
      references: { table: "payment_terms", field: "id" },
      onUpdate: "CASCADE",
      onDelete: "RESTRICT",
    });

    await queryInterface.changeColumn(TABLE, COLUMN, {
      type: Sequelize.INTEGER,
      allowNull: false,
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.changeColumn(TABLE, COLUMN, {
      type: Sequelize.INTEGER,
      allowNull: true,
    });
    await queryInterface.removeConstraint(TABLE, FOREIGN_KEY);
  },
};
