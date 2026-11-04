/**
 * Converts a DATEONLY value into a `YYYY-MM-DD` string without time.
 * @param {unknown} value - Date, string or null.
 * @returns {string|null} The date or null.
 */
function toDateOnly(value) {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }

  if (typeof value === "string") {
    return value.slice(0, 10);
  }

  return null;
}

/**
 * Reads the numeric quantity of an allocation, defaulting to zero.
 * @param {unknown} value - Raw quantity.
 * @returns {number} The numeric quantity.
 */
function toQuantity(value) {
  const numeric = Number(value);

  return Number.isFinite(numeric) ? numeric : 0;
}

module.exports = { toDateOnly, toQuantity };
