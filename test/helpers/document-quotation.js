const { createQuotationService } = require("../../src/documents/quotation");

const SOURCE_CURRENCY = Object.freeze({
  id: 3,
  code: "USD_BCV",
  name: "Dólar BCV",
  symbol: "$",
  rate: "889.890000",
  is_base: false,
  is_active: true,
});
const BASE_CURRENCY = Object.freeze({
  id: 1,
  code: "VES",
  name: "Bolívar",
  symbol: "Bs",
  rate: "1.000000",
  is_base: true,
  is_active: true,
});
const ISSUED_AT = new Date("2026-11-03T12:00:00.000Z");

/**
 * Builds an order snapshot as returned by the orders service.
 * @param {object} [overrides] - Attribute overrides.
 * @returns {object} The order.
 */
function orderSnapshot(overrides = {}) {
  return {
    id: 10,
    number: 10,
    status: "generate",
    customer_id: 8,
    currency_id: 3,
    subtotal: "120.00",
    total: "120.00",
    delivery_address: "Av. Monseñor Rivero 123",
    notes: "Entregar por la tarde",
    createdAt: new Date("2026-11-02T14:30:00.000Z"),
    currency: { ...SOURCE_CURRENCY },
    customer: {
      id: 8,
      fullName: "Cliente Demo",
      email: "cliente@example.com",
      direction: "Calle 1",
    },
    payment_term: { id: 1, code: "cash", name: "Contado", days: 0 },
    items: [
      {
        id: 1,
        quantity: 2,
        unit_price: "60.00",
        subtotal: "120.00",
        product: { id: 5, name: "Ibuprofeno", reference: "REF-1" },
        item_state: { id: 1, name: "sellable", label: "Vendible" },
      },
    ],
    ...overrides,
  };
}

/**
 * Builds the service with fakes.
 * @param {object} [order] - Order returned by the orders service.
 * @returns {object} The fake dependencies and the service.
 */
function buildService(order = orderSnapshot()) {
  const orderService = {
    getOrder: jest.fn().mockResolvedValue({
      order,
      context: { role: "admin", userId: 1, customerId: null },
    }),
  };
  const currencyRepository = {
    findBaseCurrency: jest.fn().mockResolvedValue(BASE_CURRENCY),
    findCurrencyById: jest.fn(),
    findLatestRateChange: jest.fn().mockImplementation((currencyId) =>
      Promise.resolve({
        changed_at:
          currencyId === 3
            ? new Date("2026-11-01T10:00:00.000Z")
            : new Date("2026-10-30T08:00:00.000Z"),
      }),
    ),
  };
  const service = createQuotationService({
    orderService,
    currencyRepository,
    clock: () => ISSUED_AT,
  });

  return { service, orderService, currencyRepository };
}

/**
 * Asserts a controlled HTTP error.
 * @param {Promise<unknown>} promise - Operation.
 * @param {number} status - Expected status.
 * @param {object} body - Expected body.
 * @returns {Promise<void>}
 */
async function expectHttpError(promise, status, body) {
  await expect(promise).rejects.toMatchObject({ status, body });
}

module.exports = {
  BASE_CURRENCY,
  ISSUED_AT,
  SOURCE_CURRENCY,
  buildService,
  expectHttpError,
  orderSnapshot,
};
