const MethodPayment = require("../../src/models/method-payment");
const MethodPaymentType = require("../../src/models/method-payment-type");
const User = require("../../src/models/user");
const {
  as,
  createCurrency,
  createMethodPaymentType,
  tokenFor,
  uniqueCode,
  uniqueCurrencyCode,
} = require("./method-payment-types");

const DEFAULT_DETAILS = Object.freeze({ email: "pagos@farmamad.com" });

/**
 * Generates a unique label for a method payment.
 * @param {string} [prefix] - Optional prefix.
 * @returns {string} The generated label.
 */
function uniqueLabel(prefix = "Método") {
  return `${prefix} ${Math.random().toString(36).slice(2, 10)}`.slice(0, 100);
}

/**
 * Creates a method payment directly in the database. When the type is omitted
 * it creates an active currency and a PayPal-like type first; when the details
 * are omitted it uses the default PayPal details.
 * @param {object} [overrides] - Attribute overrides.
 * @returns {Promise<object>} The created instance.
 */
async function createMethodPayment(overrides = {}) {
  const values = {
    label: uniqueLabel(),
    details: { ...DEFAULT_DETAILS },
    is_active: true,
    ...overrides,
  };

  if (values.method_payment_type_id === undefined) {
    const currency = await createCurrency();
    const type = await createMethodPaymentType({
      currency_id: currency.id,
      fields: [
        { key: "email", label: "Correo", type: "email", required: true },
      ],
    });

    values.method_payment_type_id = type.id;
  }

  return MethodPayment.create(values);
}

/**
 * Truncates the method payments, types and users of the test database. Methods
 * go first so the restrictive foreign key never blocks the cleanup.
 * @returns {Promise<void>} Resolves once the tables are empty.
 */
async function resetDatabase() {
  await MethodPayment.destroy({
    where: {},
    truncate: { cascade: true, restartIdentity: true },
  });
  await MethodPaymentType.destroy({
    where: {},
    truncate: { cascade: true, restartIdentity: true },
  });
  await User.destroy({
    where: {},
    truncate: { cascade: true, restartIdentity: true },
  });
}

module.exports = {
  DEFAULT_DETAILS,
  as,
  createCurrency,
  createMethodPayment,
  createMethodPaymentType,
  resetDatabase,
  tokenFor,
  uniqueCode,
  uniqueCurrencyCode,
  uniqueLabel,
};
