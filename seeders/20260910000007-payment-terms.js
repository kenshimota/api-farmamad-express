"use strict";

const TABLE = "payment_terms";
const TERMS = Object.freeze([
  {
    code: "cash",
    name: "Contado",
    description: "Pago contra entrega o al momento de la venta",
    days: 0,
  },
  {
    code: "credit_10",
    name: "Crédito 10 días",
    description: "Pago a 10 días",
    days: 10,
  },
  {
    code: "credit_15",
    name: "Crédito 15 días",
    description: "Pago a 15 días",
    days: 15,
  },
]);

/**
 * Resolves the id of a term by code.
 * @param {object} queryInterface - Sequelize query interface.
 * @param {string} code - Payment term code.
 * @returns {Promise<number|null>} The id or null when it does not exist.
 */
async function findId(queryInterface, code) {
  const id = await queryInterface.rawSelect(TABLE, { where: { code } }, ["id"]);

  return id === undefined || id === null ? null : id;
}

/**
 * Seeds the standard payment terms without overwriting customised rows. The
 * seeder is idempotent: running it twice does not duplicate the catalog and
 * never deletes terms created through the API.
 * @type {import('sequelize-cli').Seeder}
 */
module.exports = {
  async up(queryInterface) {
    const now = new Date();

    for (const term of TERMS) {
      if ((await findId(queryInterface, term.code)) !== null) {
        continue;
      }

      await queryInterface.bulkInsert(TABLE, [
        {
          ...term,
          is_active: true,
          createdAt: now,
          updatedAt: now,
        },
      ]);
    }
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete(TABLE, {
      code: TERMS.map((term) => term.code),
    });
  },
};
