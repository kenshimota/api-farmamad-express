"use strict";

const SEQUENCE = "purchases_number_seq";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    // A native PostgreSQL sequence gives unique, ascending numbers without a
    // table-level lock. Gaps are acceptable when a transaction fails.
    await queryInterface.sequelize.query(
      `CREATE SEQUENCE IF NOT EXISTS "${SEQUENCE}" START WITH 1 INCREMENT BY 1`,
    );
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(
      `DROP SEQUENCE IF EXISTS "${SEQUENCE}"`,
    );
  },
};
