const { readField } = require("../shared/serializer");

/**
 * Tells whether a currency can be used in the calculation: it must exist, be
 * active (when the flag is present) and have a positive rate.
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

module.exports = { isUsableCurrency };
