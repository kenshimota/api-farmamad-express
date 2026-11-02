"use strict";

const TABLE = "payment_statuses";
const BASE_STATUSES = Object.freeze([
  {
    code: "pending",
    name: "Pendiente",
    description: null,
    sort_order: 10,
    is_system: true,
  },
  {
    code: "conciliated",
    name: "Conciliado",
    description: null,
    sort_order: 20,
    is_system: true,
  },
  {
    code: "rejected",
    name: "Rechazado",
    description: null,
    sort_order: 30,
    is_system: true,
  },
]);
const CODES = Object.freeze(BASE_STATUSES.map((status) => status.code));

/**
 * Inserts the three payment reconciliation statuses without overwriting an
 * existing row, so running the seeder twice never duplicates the catalog and
 * never resets an already migrated row.
 * @type {import('sequelize-cli').Seeder}
 */
module.exports = {
  async up(queryInterface) {
    const now = new Date();

    for (const status of BASE_STATUSES) {
      const existing = await queryInterface.rawSelect(
        TABLE,
        { where: { code: status.code } },
        ["id"],
      );

      if (existing !== undefined && existing !== null) {
        continue;
      }

      await queryInterface.bulkInsert(TABLE, [
        {
          ...status,
          createdAt: now,
          updatedAt: now,
        },
      ]);
    }
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete(TABLE, { code: CODES });
  },

  BASE_STATUSES,
};
