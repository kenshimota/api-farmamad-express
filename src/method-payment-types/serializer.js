const { toPublicCurrencySummary } = require("../currencies/serializer");
const { readField } = require("../shared/serializer");

/**
 * Builds the public representation of a method payment type with no audit
 * columns. The nested currency is the compact summary used by the rest of the
 * API.
 * @param {object} type - MethodPaymentType instance or plain object.
 * @returns {{ id: number, code: string, name: string, currency_id: number,
 *   currency: object|null, fields: object[], description: string|null,
 *   is_active: boolean }} Public data.
 */
function toPublicMethodPaymentType(type) {
  const currency = readField(type, "currency");
  const fields = readField(type, "fields");

  return {
    id: readField(type, "id"),
    code: readField(type, "code"),
    name: readField(type, "name"),
    currency_id: readField(type, "currency_id"),
    currency: currency ? toPublicCurrencySummary(currency) : null,
    fields: Array.isArray(fields) ? [...fields] : [],
    description: readField(type, "description") ?? null,
    is_active: readField(type, "is_active") === true,
  };
}

module.exports = { toPublicMethodPaymentType };
