"use strict";

const TABLE = "customers";
const COLUMN = "payment_term_id";
const FOREIGN_KEY = "customers_payment_term_id_fkey";
const INDEX = "customers_payment_term_id_idx";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn(TABLE, COLUMN, {
      type: Sequelize.INTEGER,
      allowNull: true,
    });

    await queryInterface.addConstraint(TABLE, {
      fields: [COLUMN],
      type: "foreign key",
      name: FOREIGN_KEY,
      references: { table: "payment_terms", field: "id" },
      onUpdate: "CASCADE",
      onDelete: "RESTRICT",
    });

    await queryInterface.addIndex(TABLE, [COLUMN], { name: INDEX });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex(TABLE, INDEX);
    await queryInterface.removeConstraint(TABLE, FOREIGN_KEY);
    await queryInterface.removeColumn(TABLE, COLUMN);
  },
};
