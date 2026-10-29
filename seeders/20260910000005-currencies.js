"use strict";

const CURRENCIES_TABLE = "currencies";
const HISTORY_TABLE = "currency_rate_history";
const CURRENCIES = Object.freeze([
  {
    code: "VES",
    name: "Bolívar",
    symbol: "Bs",
    rate: "1.000000",
    is_base: true,
  },
  {
    code: "USDT",
    name: "Tether",
    symbol: "$",
    rate: "1000.290000",
    is_base: false,
  },
  {
    code: "USD_BCV",
    name: "Dólar BCV",
    symbol: "$",
    rate: "889.890000",
    is_base: false,
  },
]);

/**
 * Resolves the id of a currency by its code.
 * @param {object} queryInterface - Sequelize query interface.
 * @param {string} code - Currency code.
 * @returns {Promise<number|null>} The id or null when it does not exist.
 */
async function findId(queryInterface, code) {
  const id = await queryInterface.rawSelect(
    CURRENCIES_TABLE,
    { where: { code } },
    ["id"],
  );

  return id === undefined || id === null ? null : id;
}

/**
 * Appends the initial history row of a seeded currency, attributed to no user.
 * @param {object} queryInterface - Sequelize query interface.
 * @param {number} currencyId - Currency id.
 * @param {string} rate - Seeded rate.
 * @param {Date} changedAt - Seeding timestamp.
 * @returns {Promise<void>}
 */
function insertHistory(queryInterface, currencyId, rate, changedAt) {
  return queryInterface.bulkInsert(HISTORY_TABLE, [
    {
      currency_id: currencyId,
      previous_rate: null,
      new_rate: rate,
      changed_by: null,
      changed_at: changedAt,
      reason: "seed",
    },
  ]);
}

/**
 * Removes a seeded currency and its history, never touching other rows.
 * @param {object} queryInterface - Sequelize query interface.
 * @param {number} currencyId - Currency id.
 * @returns {Promise<void>}
 */
async function removeCurrency(queryInterface, currencyId) {
  await queryInterface.bulkDelete(
    HISTORY_TABLE,
    { currency_id: currencyId },
    {},
  );
  await queryInterface.bulkDelete(CURRENCIES_TABLE, { id: currencyId }, {});
}

/** @type {import('sequelize-cli').Seeder} */
module.exports = {
  async up(queryInterface) {
    const now = new Date();

    for (const currency of CURRENCIES) {
      // Never overwrite an existing currency: an administrator may have
      // already changed its rate.
      if ((await findId(queryInterface, currency.code)) !== null) {
        continue;
      }

      await queryInterface.bulkInsert(CURRENCIES_TABLE, [
        {
          ...currency,
          is_active: true,
          createdAt: now,
          updatedAt: now,
        },
      ]);

      const currencyId = await findId(queryInterface, currency.code);

      if (currencyId !== null) {
        await insertHistory(queryInterface, currencyId, currency.rate, now);
      }
    }
  },

  async down(queryInterface) {
    for (const currency of CURRENCIES) {
      const currencyId = await findId(queryInterface, currency.code);

      if (currencyId !== null) {
        await removeCurrency(queryInterface, currencyId);
      }
    }
  },
};
