const Currency = require("../../src/models/currency");

const DEFAULT_CODE = "USD_BCV";
const DEFAULT_RATE = "889.890000";

/**
 * Ensures the integration database has an active default transaction currency
 * (USD_BCV), recreating it when another suite truncated the currencies table.
 * @returns {Promise<object>} The default currency instance.
 */
async function ensureDefaultTransactionCurrency() {
  await Currency.update(
    { is_default_for_transactions: false },
    { where: { is_default_for_transactions: true } },
  );

  const existing = await Currency.findOne({ where: { code: DEFAULT_CODE } });

  if (existing) {
    return existing.update({
      is_active: true,
      is_default_for_transactions: true,
    });
  }

  return Currency.create({
    code: DEFAULT_CODE,
    name: "Dólar BCV",
    symbol: "$",
    rate: DEFAULT_RATE,
    is_base: false,
    is_active: true,
    is_default_for_transactions: true,
  });
}

/**
 * Builds the public summary of a currency used in nested responses.
 * @param {object} currency - Stored currency.
 * @returns {{ id: number, code: string, name: string, symbol: string }}
 *   Public summary.
 */
function publicCurrencySummary(currency) {
  return {
    id: currency.id,
    code: currency.code,
    name: currency.name,
    symbol: currency.symbol,
  };
}

module.exports = {
  DEFAULT_CODE,
  ensureDefaultTransactionCurrency,
  publicCurrencySummary,
};
