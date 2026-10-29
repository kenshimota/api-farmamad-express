"use strict";

const CURRENCIES = "currencies";
const HISTORY = "currency_rate_history";
const COSTS = "costs";
const PURCHASES = "purchases";
const DEFAULT_COLUMN = "is_default_for_transactions";
const DEFAULT_INDEX = "currencies_default_transaction_unique";
const COSTS_CURRENCY_INDEX = "costs_currency_id_idx";
const COSTS_CURRENCY_FK = "costs_currency_id_fkey";
const PURCHASES_CURRENCY_INDEX = "purchases_currency_id_idx";
const PURCHASES_CURRENCY_FK = "purchases_currency_id_fkey";
const DEFAULT_CURRENCY = Object.freeze({
  code: "USD_BCV",
  name: "Dólar BCV",
  symbol: "$",
  rate: "889.890000",
});
const CURRENCY_COLUMN_TARGETS = Object.freeze([
  { table: COSTS, index: COSTS_CURRENCY_INDEX, foreignKey: COSTS_CURRENCY_FK },
  {
    table: PURCHASES,
    index: PURCHASES_CURRENCY_INDEX,
    foreignKey: PURCHASES_CURRENCY_FK,
  },
]);

/**
 * Reads the id of a currency by code.
 * @param {object} queryInterface - Sequelize query interface.
 * @param {string} code - Currency code.
 * @param {object} transaction - Open transaction.
 * @returns {Promise<number|null>} The id or null.
 */
async function findCurrencyId(queryInterface, code, transaction) {
  const id = await queryInterface.rawSelect(
    CURRENCIES,
    { where: { code }, transaction },
    ["id"],
  );

  return id === undefined || id === null ? null : id;
}

/**
 * Ensures USD_BCV exists, is active and is the only default transaction
 * currency. A missing row is inserted together with its migration history.
 * @param {object} queryInterface - Sequelize query interface.
 * @param {object} Sequelize - Sequelize types.
 * @param {object} transaction - Open transaction.
 * @returns {Promise<number>} The currency id.
 */
async function ensureDefaultCurrency(queryInterface, Sequelize, transaction) {
  const now = new Date();
  let currencyId = await findCurrencyId(
    queryInterface,
    DEFAULT_CURRENCY.code,
    transaction,
  );

  if (currencyId === null) {
    await queryInterface.bulkInsert(
      CURRENCIES,
      [
        {
          ...DEFAULT_CURRENCY,
          is_base: false,
          is_active: true,
          [DEFAULT_COLUMN]: true,
          createdAt: now,
          updatedAt: now,
        },
      ],
      { transaction },
    );

    currencyId = await findCurrencyId(
      queryInterface,
      DEFAULT_CURRENCY.code,
      transaction,
    );

    await queryInterface.bulkInsert(
      HISTORY,
      [
        {
          currency_id: currencyId,
          previous_rate: null,
          new_rate: DEFAULT_CURRENCY.rate,
          changed_by: null,
          changed_at: now,
          reason: "migration",
        },
      ],
      { transaction },
    );
  }

  // The partial unique index only allows one default row, so clear any other
  // default before marking USD_BCV.
  await queryInterface.bulkUpdate(
    CURRENCIES,
    { [DEFAULT_COLUMN]: false },
    { [DEFAULT_COLUMN]: true },
    { transaction },
  );
  await queryInterface.bulkUpdate(
    CURRENCIES,
    { is_active: true, [DEFAULT_COLUMN]: true },
    { id: currencyId },
    { transaction },
  );

  return currencyId;
}

/**
 * Adds the currency column to a table, backfills it and makes it required.
 * @param {object} queryInterface - Sequelize query interface.
 * @param {object} Sequelize - Sequelize types.
 * @param {object} transaction - Open transaction.
 * @param {object} target - Table, index and constraint names.
 * @param {string} target.table - Table name.
 * @param {string} target.index - Index name.
 * @param {string} target.foreignKey - Foreign key constraint name.
 * @param {number} currencyId - Default currency id.
 * @returns {Promise<void>}
 */
async function addCurrencyColumn(
  queryInterface,
  Sequelize,
  transaction,
  { table, index, foreignKey },
  currencyId,
) {
  await queryInterface.addColumn(
    table,
    "currency_id",
    { type: Sequelize.INTEGER, allowNull: true },
    { transaction },
  );
  await queryInterface.bulkUpdate(
    table,
    { currency_id: currencyId },
    { currency_id: null },
    { transaction },
  );
  await queryInterface.changeColumn(
    table,
    "currency_id",
    { type: Sequelize.INTEGER, allowNull: false },
    { transaction },
  );
  await queryInterface.addConstraint(table, {
    fields: ["currency_id"],
    type: "foreign key",
    name: foreignKey,
    references: { table: CURRENCIES, field: "id" },
    onUpdate: "CASCADE",
    onDelete: "RESTRICT",
    transaction,
  });
  await queryInterface.addIndex(table, ["currency_id"], {
    name: index,
    transaction,
  });
}

/**
 * Removes the currency column of a table with its index and foreign key.
 * @param {object} queryInterface - Sequelize query interface.
 * @param {object} transaction - Open transaction.
 * @param {object} target - Table, index and constraint names.
 * @param {string} target.table - Table name.
 * @param {string} target.index - Index name.
 * @param {string} target.foreignKey - Foreign key constraint name.
 * @returns {Promise<void>}
 */
async function removeCurrencyColumn(
  queryInterface,
  transaction,
  { table, index, foreignKey },
) {
  await queryInterface.removeConstraint(table, foreignKey, { transaction });
  await queryInterface.removeIndex(table, index, { transaction });
  await queryInterface.removeColumn(table, "currency_id", { transaction });
}

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.addColumn(
        CURRENCIES,
        DEFAULT_COLUMN,
        {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: false,
        },
        { transaction },
      );

      const currencyId = await ensureDefaultCurrency(
        queryInterface,
        Sequelize,
        transaction,
      );

      await queryInterface.addIndex(CURRENCIES, [DEFAULT_COLUMN], {
        unique: true,
        where: { [DEFAULT_COLUMN]: true },
        name: DEFAULT_INDEX,
        transaction,
      });

      for (const target of CURRENCY_COLUMN_TARGETS) {
        await addCurrencyColumn(
          queryInterface,
          Sequelize,
          transaction,
          target,
          currencyId,
        );
      }
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      for (const target of [...CURRENCY_COLUMN_TARGETS].reverse()) {
        await removeCurrencyColumn(queryInterface, transaction, target);
      }
      await queryInterface.removeIndex(CURRENCIES, DEFAULT_INDEX, {
        transaction,
      });
      await queryInterface.removeColumn(CURRENCIES, DEFAULT_COLUMN, {
        transaction,
      });
    });
  },
};
