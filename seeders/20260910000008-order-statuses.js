"use strict";

const TABLE = "order_statuses";
const BASE_STATUSES = Object.freeze([
  {
    code: "draft",
    name: "Borrador",
    description: null,
    sort_order: 10,
    next_status_code: "request",
    is_system: true,
  },
  {
    code: "request",
    name: "Solicitado",
    description: null,
    sort_order: 20,
    next_status_code: "generate",
    is_system: true,
  },
  {
    code: "generate",
    name: "Generado",
    description: null,
    sort_order: 30,
    next_status_code: "invoiced",
    is_system: true,
  },
  {
    code: "invoiced",
    name: "Facturado",
    description: null,
    sort_order: 40,
    next_status_code: null,
    is_system: true,
  },
  {
    code: "cancelled",
    name: "Cancelado",
    description: null,
    sort_order: 50,
    next_status_code: null,
    is_system: true,
  },
]);
const CODES = Object.freeze(BASE_STATUSES.map((status) => status.code));

/**
 * Inserts the five base statuses without touching additional rows created
 * through the CRUD. Running the seeder twice never duplicates the catalog and
 * never deletes a customised name, description or sort order.
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
