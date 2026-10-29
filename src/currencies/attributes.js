/**
 * Columns that make up the compact currency nested in costs, purchases and
 * stocks. Repositories use them in their Sequelize includes so the persisted
 * projection always matches `toPublicCurrencySummary`.
 */
const CURRENCY_SUMMARY_ATTRIBUTES = Object.freeze([
  "id",
  "code",
  "name",
  "symbol",
]);

module.exports = { CURRENCY_SUMMARY_ATTRIBUTES };
