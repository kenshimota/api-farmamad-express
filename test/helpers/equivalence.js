const { createEquivalenceService } = require("../../src/equivalence/service");

const SOURCE_CURRENCY = {
  id: 3,
  code: "USD_BCV",
  name: "Dólar BCV",
  symbol: "$",
  rate: "889.890000",
  is_base: false,
  is_active: true,
};
const BASE_CURRENCY = {
  id: 1,
  code: "VES",
  name: "Bolívar",
  symbol: "Bs",
  rate: "1.000000",
  is_base: true,
  is_active: true,
};
const TARGET_CURRENCY = {
  id: 2,
  code: "USDT",
  name: "Tether",
  symbol: "$",
  rate: "1000.290000",
  is_base: false,
  is_active: true,
};
const SOURCE_UPDATED_AT = new Date("2026-11-02T12:00:00.000Z");
const NOW = new Date("2026-11-03T15:00:00.000Z");

function orderFixture(overrides = {}) {
  return {
    id: 10,
    number: 10,
    status: "generate",
    customer_id: 8,
    currency_id: 3,
    subtotal: "85.00",
    total: "85.00",
    payment_term_id: 1,
    createdAt: new Date("2026-11-02T14:30:00.000Z"),
    payment_term: { id: 1, code: "cash", name: "Contado", days: 0 },
    items: [
      {
        id: 20,
        product_id: 15,
        item_state_id: 1,
        quantity: 10,
        unit_price: "8.50",
        subtotal: "85.00",
        product: { id: 15, name: "Producto demo", reference: "REF-015" },
        item_state: { id: 1, name: "sellable", label: "Vendible" },
      },
    ],
    ...overrides,
  };
}

function invoiceFixture(overrides = {}) {
  return {
    id: 7,
    number: 7,
    order_id: 10,
    customer_id: 8,
    currency_id: 3,
    payment_term_id: 1,
    payment_status: "partial",
    subtotal: "85.00",
    tax_amount: "0.00",
    total: "85.00",
    paid_amount: "10.00",
    issued_at: new Date("2026-11-02T15:00:00.000Z"),
    due_date: "2026-11-02",
    payment_term: { id: 1, code: "cash", name: "Contado", days: 0 },
    items: [
      {
        order_item_id: 20,
        product_id: 15,
        product_name: "Producto demo",
        product_reference: "REF-015",
        item_state_id: 1,
        item_state_name: "Vendible",
        quantity: 10,
        unit_price: "8.50",
        subtotal: "85.00",
      },
    ],
    ...overrides,
  };
}

function buildService({ order, invoice } = {}) {
  const repository = {
    findCurrencyById: jest.fn((id) =>
      Promise.resolve(
        [SOURCE_CURRENCY, TARGET_CURRENCY, BASE_CURRENCY].find(
          (currency) => currency.id === id,
        ) ?? null,
      ),
    ),
    findBaseCurrency: jest.fn(() => Promise.resolve(BASE_CURRENCY)),
    findLatestRateChanges: jest.fn((ids) =>
      Promise.resolve(
        Object.fromEntries(
          ids
            .filter((id) => id === SOURCE_CURRENCY.id)
            .map((id) => [id, SOURCE_UPDATED_AT]),
        ),
      ),
    ),
    findOrderNumber: jest.fn(() => Promise.resolve(10)),
  };
  const orders = {
    getOrder: jest.fn(() =>
      Promise.resolve({ order, context: { role: "admin" } }),
    ),
  };
  const invoices = { getInvoice: jest.fn(() => Promise.resolve(invoice)) };
  const service = createEquivalenceService({
    repository,
    orders,
    invoices,
    clock: () => NOW,
  });

  return { service, repository, orders, invoices };
}

module.exports = {
  BASE_CURRENCY,
  NOW,
  SOURCE_CURRENCY,
  SOURCE_UPDATED_AT,
  TARGET_CURRENCY,
  buildService,
  invoiceFixture,
  orderFixture,
};
