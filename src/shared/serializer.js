/**
 * Reads a field from a Sequelize instance or a plain object.
 * @param {object} record - Sequelize instance or plain object.
 * @param {string} field - Field name.
 * @returns {unknown} The raw value.
 */
function readField(record, field) {
  return typeof record.get === "function" ? record.get(field) : record[field];
}

/**
 * Converts a DECIMAL value (usually a string) into a JSON number rounded to
 * the requested number of decimals. Empty, null and non-numeric values become
 * null so serializers never expose `NaN`.
 * @param {unknown} value - Raw DECIMAL value.
 * @param {number} decimals - Number of decimals kept in the result.
 * @returns {number|null} The numeric value or null when it is not numeric.
 */
function toDecimalNumber(value, decimals) {
  if (
    value === null ||
    value === undefined ||
    (typeof value === "string" && value.trim() === "")
  ) {
    return null;
  }

  const numeric = Number(value);

  if (!Number.isFinite(numeric)) {
    return null;
  }

  return Number(numeric.toFixed(decimals));
}

module.exports = { readField, toDecimalNumber };
