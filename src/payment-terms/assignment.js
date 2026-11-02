const PaymentTerm = require("../models/payment-term");
const { createHttpError } = require("../shared/http-error");

const INVALID_PAYMENT_TERM_MESSAGE = "Invalid payment term";

/**
 * 422 response used when a term does not exist or is inactive.
 * @returns {Error & { status: number, body: object }} The HTTP error.
 */
function invalidPaymentTerm() {
  return createHttpError(422, {
    errors: { payment_term_id: INVALID_PAYMENT_TERM_MESSAGE },
  });
}

/**
 * Loads a payment term only when it can be assigned to a new customer, order
 * or invoice. Missing and inactive terms resolve to null.
 * @param {number|null|undefined} id - Payment term id.
 * @returns {Promise<object|null>} The active term or null.
 */
async function findAssignablePaymentTerm(id) {
  if (id === null || id === undefined) {
    return null;
  }

  const term = await PaymentTerm.findByPk(id);

  if (!term || term.is_active === false) {
    return null;
  }

  return term;
}

/**
 * Ensures a term exists and is active.
 * @param {number|null|undefined} id - Payment term id.
 * @returns {Promise<object>} The active term.
 * @throws {Error} 422 when the term is missing or inactive.
 */
async function assertAssignablePaymentTerm(id) {
  const term = await findAssignablePaymentTerm(id);

  if (!term) {
    throw invalidPaymentTerm();
  }

  return term;
}

module.exports = {
  INVALID_PAYMENT_TERM_MESSAGE,
  assertAssignablePaymentTerm,
  findAssignablePaymentTerm,
  invalidPaymentTerm,
};
