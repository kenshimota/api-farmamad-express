const { createInvoiceService } = require("../../src/invoices/service");

const TRANSACTION = Object.freeze({ LOCK: { UPDATE: "UPDATE" } });
const NOW = new Date("2026-11-01T12:00:00.000Z");
const INVOICE = {
  id: 1,
  number: 1,
  order_id: 10,
  customer_id: 8,
  currency_id: 3,
  payment_term_id: 3,
  subtotal: "25.00",
  tax_amount: "0.00",
  total: "25.00",
  paid_amount: "0.00",
  payment_status: "pending",
  issued_at: NOW,
  due_date: "2026-11-16",
};
const ITEM = {
  order_item_id: 20,
  product_id: 15,
  product_name: "Ibuprofeno 400 mg",
  product_reference: "IBU-400",
  item_state_id: 1,
  item_state_name: "sellable",
  quantity: 2,
  unit_price: 12.5,
  subtotal: 25,
};
const INPUT = {
  order_id: 10,
  customer_id: 8,
  invoiced_by_user_id: 1,
  currency_id: 3,
  payment_term_id: 3,
  payment_term_days: 15,
  subtotal: 25,
  total: 25,
  notes: "Factura",
  items: [ITEM],
};

/**
 * Builds an invoice repository double with successful defaults.
 * @param {object} [overrides] - Method overrides.
 * @returns {object} The repository double.
 */
function repositoryDouble(overrides = {}) {
  return {
    transaction: jest.fn((callback) => callback(TRANSACTION)),
    nextNumber: jest.fn().mockResolvedValue(1),
    create: jest.fn(async (values) => ({ id: 1, ...values })),
    createItems: jest.fn().mockResolvedValue([]),
    list: jest.fn().mockResolvedValue([]),
    findById: jest.fn().mockResolvedValue(INVOICE),
    findByOrderId: jest.fn().mockResolvedValue(INVOICE),
    hasOrderInvoice: jest.fn().mockResolvedValue(false),
    findUserById: jest.fn().mockResolvedValue({ id: 5, customer_id: 8 }),
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
    service: createInvoiceService({ repository, clock: () => NOW }),
  };
}

module.exports = {
  INPUT,
  INVOICE,
  ITEM,
  NOW,
  TRANSACTION,
  buildService,
  repositoryDouble,
};
