const PaymentTerm = require("../../src/models/payment-term");

const STANDARD_TERMS = Object.freeze([
  {
    code: "cash",
    name: "Contado",
    description: "Pago contra entrega o al momento de la venta",
    days: 0,
  },
  {
    code: "credit_10",
    name: "Crédito 10 días",
    description: "Pago a 10 días",
    days: 10,
  },
  {
    code: "credit_15",
    name: "Crédito 15 días",
    description: "Pago a 15 días",
    days: 15,
  },
]);

/**
 * Generates a unique lowercase code.
 * @param {string} [prefix] - Optional code prefix.
 * @returns {string} The generated code.
 */
function uniqueCode(prefix = "test") {
  return `${prefix}_${Math.random().toString(36).slice(2, 8)}`.slice(0, 30);
}

/**
 * Ensures one of the standard terms exists and returns it.
 * @param {string} [code] - Standard term code.
 * @returns {Promise<object>} The stored term.
 */
async function ensurePaymentTerm(code = "cash") {
  const base = STANDARD_TERMS.find((term) => term.code === code);

  if (!base) {
    throw new Error(`Unknown standard payment term "${code}"`);
  }

  const [term] = await PaymentTerm.findOrCreate({
    where: { code },
    defaults: base,
  });

  if (term.is_active === false) {
    // Standard terms are shared by every suite; reactivate them so a test that
    // disables one does not leak an inactive term into the next test.
    await term.update({ is_active: true });
  }

  return term;
}

/**
 * Ensures the three standard terms exist.
 * @returns {Promise<Record<string, object>>} Terms keyed by code.
 */
async function ensureStandardPaymentTerms() {
  const terms = {};

  for (const term of STANDARD_TERMS) {
    terms[term.code] = await ensurePaymentTerm(term.code);
  }

  return terms;
}

/**
 * Creates a custom term directly in the database.
 * @param {object} [overrides] - Attribute overrides.
 * @returns {Promise<object>} The created term.
 */
function createPaymentTerm(overrides = {}) {
  return PaymentTerm.create({
    code: uniqueCode(),
    name: "Término de prueba",
    description: null,
    days: 20,
    is_active: true,
    ...overrides,
  });
}

module.exports = {
  STANDARD_TERMS,
  createPaymentTerm,
  ensurePaymentTerm,
  ensureStandardPaymentTerms,
  uniqueCode,
};
