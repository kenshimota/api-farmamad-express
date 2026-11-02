/**
 * Reads a field from a Sequelize instance or a plain object.
 * @param {object} term - Sequelize instance or plain object.
 * @param {string} field - Field name.
 * @returns {unknown} The raw value.
 */
function readField(term, field) {
  return typeof term.get === "function" ? term.get(field) : term[field];
}

/**
 * Builds the public representation of a payment term without audit columns.
 * @param {object} term - PaymentTerm instance or plain object.
 * @returns {{ id: number, code: string, name: string,
 *   description: string|null, days: number, is_active: boolean }} Public data.
 */
function toPublicPaymentTerm(term) {
  return {
    id: readField(term, "id"),
    code: readField(term, "code"),
    name: readField(term, "name"),
    description: readField(term, "description"),
    days: readField(term, "days"),
    is_active: readField(term, "is_active"),
  };
}

/**
 * Builds the compact payment term nested in customers, orders and invoices.
 * @param {object} term - PaymentTerm instance or plain object.
 * @returns {{ id: number, code: string, name: string, days: number }}
 *   Public summary.
 */
function toPublicPaymentTermSummary(term) {
  return {
    id: readField(term, "id"),
    code: readField(term, "code"),
    name: readField(term, "name"),
    days: readField(term, "days"),
  };
}

module.exports = { toPublicPaymentTerm, toPublicPaymentTermSummary };
