const {
  createInvoicePaymentService,
} = require("../../src/invoice-payments/service");

const TRANSACTION = Object.freeze({ LOCK: { UPDATE: "UPDATE" } });
const NOW = new Date("2026-11-01T13:00:00.000Z");
const CURRENCY = Object.freeze({
  id: 2,
  code: "USDT",
  name: "Tether",
  symbol: "$",
  rate: "2.000000",
});
const INVOICE_CURRENCY = Object.freeze({
  id: 3,
  code: "USD_BCV",
  name: "Dólar BCV",
  symbol: "$",
  rate: "1.000000",
});
const METHOD = Object.freeze({ id: 4, label: "Binance Farmamad" });
const METHOD_TYPE = Object.freeze({ id: 2, code: "BINANCE", name: "Binance" });
const INVOICE = Object.freeze({
  id: 1,
  number: 1,
  customer_id: 8,
  currency_id: 3,
  total: "25.00",
  paid_amount: "0.00",
  payment_status: "pending",
  currency: INVOICE_CURRENCY,
});
const PAYMENT = Object.freeze({
  id: 5,
  customer_id: 8,
  currency_id: 2,
  amount: "100.00",
  status: "conciliated",
  currency: CURRENCY,
});
const WALLET = Object.freeze({
  id: 7,
  customer_id: 8,
  currency_id: 2,
  balance: "100.00",
});
const ALLOCATION = Object.freeze({
  id: 11,
  payment_id: 5,
  invoice_id: 1,
  amount: "10.00",
  applied_amount: "20.00",
  exchange_rate: "2.000000",
  allocated_at: NOW,
  created_by_user_id: 1,
  payment: {
    id: 5,
    currency: CURRENCY,
    method_payment: {
      id: 4,
      label: "Binance Farmamad",
      method_payment_type: METHOD_TYPE,
    },
  },
  created_by: { id: 1, username: "admin", email: "admin@example.com" },
});

/**
 * Builds an invoice-payments repository double with successful defaults.
 * @param {object} [overrides] - Method overrides.
 * @returns {object} The repository double.
 */
function repositoryDouble(overrides = {}) {
  const wallet = { ...WALLET };

  return {
    transaction: jest.fn((callback) => callback(TRANSACTION)),
    findInvoiceForUpdate: jest.fn().mockResolvedValue({ ...INVOICE }),
    findPaymentForUpdate: jest.fn().mockResolvedValue({ ...PAYMENT }),
    findAllocation: jest.fn().mockResolvedValue(null),
    findWalletForUpdate: jest.fn().mockResolvedValue(wallet),
    createAllocation: jest
      .fn()
      .mockImplementation(async (values) => ({ ...ALLOCATION, ...values })),
    debitWallet: jest.fn(async (current, amount) => ({
      ...current,
      balance: (Number(current.balance) - Number(amount)).toFixed(2),
    })),
    createWalletTransaction: jest.fn().mockResolvedValue({ id: 21 }),
    updateInvoice: jest.fn(async (invoice, values) => ({
      ...invoice,
      ...values,
    })),
    reloadAllocation: jest.fn().mockResolvedValue(ALLOCATION),
    findInvoiceById: jest.fn().mockResolvedValue({ ...INVOICE }),
    findUserById: jest.fn().mockResolvedValue({ id: 5, customer_id: 8 }),
    listAllocations: jest.fn().mockResolvedValue([]),
    ...overrides,
  };
}

/**
 * Builds the service with the injected repository and fixed clock.
 * @param {object} [repository] - Repository double.
 * @returns {{ repository: object, service: object }} The pair.
 */
function buildService(repository = repositoryDouble()) {
  return {
    repository,
    service: createInvoicePaymentService({
      repository,
      clock: () => NOW,
    }),
  };
}

module.exports = {
  ALLOCATION,
  CURRENCY,
  INVOICE,
  INVOICE_CURRENCY,
  METHOD,
  METHOD_TYPE,
  NOW,
  PAYMENT,
  TRANSACTION,
  WALLET,
  buildService,
  repositoryDouble,
};
