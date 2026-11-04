const { readField } = require("../shared/serializer");
const { calculateRate } = require("./calculations");
const {
  currencyNotFound,
  incompleteCurrencyConfiguration,
  invalidCurrency,
} = require("./errors");
const { toIso } = require("./serializer");

const RATE_SOURCE = "currencies.rate";

/**
 * Tells whether a currency has a usable positive rate.
 * @param {object} currency - Currency instance or plain object.
 * @returns {boolean} True when the rate is positive and finite.
 */
function hasValidRate(currency) {
  const rate = Number(readField(currency, "rate"));

  return Number.isFinite(rate) && rate > 0;
}

/**
 * Resolves the source and target currencies and the exchange rate. The source
 * currency may be inactive because the document already exists; only an
 * explicitly requested target is checked for `is_active`.
 * @param {object} repository - Equivalence repository.
 * @param {number} sourceId - Source currency id.
 * @param {number|undefined} targetId - Optional target currency id.
 * @returns {Promise<object>} Currencies, rate and last-change timestamps.
 */
async function resolveCurrencies(repository, sourceId, targetId) {
  const source = await repository.findCurrencyById(sourceId);
  const target =
    targetId === undefined || targetId === null
      ? await repository.findBaseCurrency()
      : await repository.findCurrencyById(targetId);

  if (targetId !== undefined && targetId !== null && !target) {
    throw currencyNotFound();
  }

  if (!source || !target) {
    throw incompleteCurrencyConfiguration();
  }

  if (
    targetId !== undefined &&
    targetId !== null &&
    readField(target, "is_active") === false
  ) {
    throw invalidCurrency();
  }

  if (!hasValidRate(source) || !hasValidRate(target)) {
    throw incompleteCurrencyConfiguration();
  }

  const changes = await repository.findLatestRateChanges([
    readField(source, "id"),
    readField(target, "id"),
  ]);

  return {
    source,
    target,
    exchangeRate: calculateRate(
      readField(source, "rate"),
      readField(target, "rate"),
    ),
    changes,
  };
}

/**
 * Builds the shared rate metadata block.
 * @param {object} context - Resolved currencies and changes.
 * @param {Date} calculatedAt - Server calculation instant.
 * @returns {object} Rate metadata.
 */
function rateMetadata(context, calculatedAt) {
  const sourceId = readField(context.source, "id");
  const targetId = readField(context.target, "id");

  return {
    exchange_rate: context.exchangeRate,
    rate_source: RATE_SOURCE,
    rates_updated_at: {
      source: toIso(context.changes[sourceId]),
      target: toIso(context.changes[targetId]),
    },
    calculated_at: calculatedAt.toISOString(),
  };
}

/**
 * Sorts lines by `order_item_id` ascending without mutating the loaded array.
 * @param {object[]} lines - Line snapshots.
 * @returns {object[]} The sorted lines.
 */
function sortLines(lines) {
  return [...lines].sort(
    (left, right) =>
      Number(readField(left, "order_item_id")) -
      Number(readField(right, "order_item_id")),
  );
}

/**
 * Resolves `payment.is_cash` from the term days.
 * @param {object|null} paymentTerm - Payment term or null.
 * @returns {boolean|null} True for cash, false for credit, null without term.
 */
function isCash(paymentTerm) {
  if (!paymentTerm) {
    return null;
  }

  return Number(readField(paymentTerm, "days")) === 0;
}

module.exports = {
  RATE_SOURCE,
  isCash,
  rateMetadata,
  resolveCurrencies,
  sortLines,
};
