const TRANSACTION = { LOCK: { UPDATE: "UPDATE" } };
const PAYPAL_FIELDS = [
  { key: "email", label: "Correo", type: "email", required: true },
];
const CURRENCY = {
  id: 3,
  code: "USD_BCV",
  name: "Dólar BCV",
  symbol: "$",
  is_active: true,
};

/**
 * Builds a repository double with successful defaults.
 * @param {object} [overrides] - Method overrides.
 * @returns {object} The repository double.
 */
function buildRepository(overrides = {}) {
  const stored = {
    id: 1,
    method_payment_type_id: 1,
    label: "PayPal Farmamad",
    details: { email: "pagos@farmamad.com" },
    is_active: true,
    method_payment_type: {
      id: 1,
      code: "PAYPAL",
      name: "PayPal",
      currency_id: 3,
      currency: CURRENCY,
    },
  };

  return {
    transaction: jest.fn((callback) => callback(TRANSACTION)),
    findType: jest.fn().mockResolvedValue({
      id: 1,
      code: "PAYPAL",
      name: "PayPal",
      currency_id: 3,
      fields: PAYPAL_FIELDS,
      is_active: true,
      currency: CURRENCY,
    }),
    create: jest.fn().mockResolvedValue(stored),
    findById: jest.fn().mockResolvedValue(stored),
    list: jest.fn().mockResolvedValue([stored]),
    update: jest.fn().mockResolvedValue(stored),
    remove: jest.fn().mockResolvedValue(),
    ...overrides,
  };
}

module.exports = {
  CURRENCY,
  PAYPAL_FIELDS,
  TRANSACTION,
  buildRepository,
};
