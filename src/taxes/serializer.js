const { readField, toDecimalNumber } = require("../shared/serializer");

/**
 * Converts the DECIMAL rate returned by Sequelize (usually a string) into a
 * JSON number rounded to two decimals. Invalid values become null.
 * @param {unknown} value - Raw DECIMAL value.
 * @returns {number|null} The numeric rate or null.
 */
function toRateNumber(value) {
  return toDecimalNumber(value, 2);
}

/**
 * Builds the public representation of a tax with no audit columns.
 * @param {object} tax - Tax instance or plain object.
 * @returns {{ id: number, code: string, name: string, rate: number|null,
 *   description: string|null, is_active: boolean }} Public tax data.
 */
function toPublicTax(tax) {
  return {
    id: readField(tax, "id"),
    code: readField(tax, "code"),
    name: readField(tax, "name"),
    rate: toRateNumber(readField(tax, "rate")),
    description: readField(tax, "description") ?? null,
    is_active: readField(tax, "is_active") === true,
  };
}

module.exports = { toPublicTax, toRateNumber };
