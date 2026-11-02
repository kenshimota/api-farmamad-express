const { calculateMarginPrice } = require("../pricing");
const { MAX_MONEY } = require("../purchases/money");
const { readField } = require("../shared/serializer");

/**
 * Tells whether a currency can be used in the calculation: it must exist, be
 * active and have a positive rate.
 * @param {object|null|undefined} currency - Currency instance or plain object.
 * @returns {boolean} True when the currency is usable.
 */
function isUsableCurrency(currency) {
  if (!currency) {
    return false;
  }

  const rate = Number(readField(currency, "rate"));

  return (
    readField(currency, "is_active") !== false &&
    Number.isFinite(rate) &&
    rate > 0
  );
}

/**
 * Resolves the price of one catalog variant from the already loaded cost,
 * cost currency, transaction currency and the customer price list. It reuses
 * the margin formula from `src/pricing/` instead of querying per variant.
 * @param {object} params - Price inputs.
 * @param {unknown} params.cost - Cost amount in the cost currency.
 * @param {object|null} params.costCurrency - Currency of the cost.
 * @param {object|null} params.transactionCurrency - Active default currency.
 * @param {unknown} params.percentage - Price list margin percentage.
 * @returns {number|null} The rounded price, or null when it is not resolvable.
 */
function resolveCatalogPrice({
  cost,
  costCurrency,
  transactionCurrency,
  percentage,
}) {
  const amount = Number(cost);
  const marginPercentage = Number(percentage);

  if (
    !Number.isFinite(amount) ||
    amount < 0 ||
    !Number.isFinite(marginPercentage) ||
    marginPercentage < 0 ||
    marginPercentage >= 100 ||
    !isUsableCurrency(costCurrency) ||
    !isUsableCurrency(transactionCurrency)
  ) {
    return null;
  }

  const price = calculateMarginPrice({
    cost: amount,
    percentage: marginPercentage,
    costRate: readField(costCurrency, "rate"),
    transactionRate: readField(transactionCurrency, "rate"),
  });

  if (!Number.isFinite(price) || price < 0 || price > MAX_MONEY) {
    return null;
  }

  return price;
}

module.exports = { isUsableCurrency, resolveCatalogPrice };
