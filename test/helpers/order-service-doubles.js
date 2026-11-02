/**
 * CURRENCY used by the order service unit tests.
 */
const TRANSACTION_CURRENCY = Object.freeze({
  id: 3,
  code: "USD_BCV",
  name: "Dólar BCV",
  symbol: "$",
  rate: "1.000000",
  is_active: true,
});

/**
 * Builds a customer-like object.
 * @param {object} [overrides] - Attribute overrides.
 * @returns {object} The customer double.
 */
function customerDouble(overrides = {}) {
  return {
    id: 8,
    fullName: "Cliente Demo",
    email: "cliente@example.com",
    direction: "Av. Monseñor Rivero 123",
    price_list_id: 1,
    ...overrides,
  };
}

/**
 * Builds a linked customer user double.
 * @param {object} [overrides] - Attribute overrides.
 * @returns {object} The user double.
 */
function userDouble(overrides = {}) {
  return {
    id: 12,
    username: "ana",
    role: "customer",
    customer_id: 8,
    isBlocked: false,
    ...overrides,
  };
}

/**
 * Builds a lot-like object with numeric ids and quantities.
 * @param {object} values - Lot attributes.
 * @returns {object} The lot double.
 */
function lotDouble(values) {
  return { stock: 0, reserved: 0, ...values };
}

/**
 * Builds a repository double recording every persistence call.
 * @param {object} [options] - Repository state.
 * @param {object} [options.user] - User returned by `findUserById`.
 * @param {object} [options.customer] - Customer returned by `findCustomerById`.
 * @param {object} [options.lots] - Lots keyed by `productId:itemStateId`.
 * @param {number} [options.number] - Next sequence number.
 * @returns {object} The repository double and its recorded calls.
 */
function createOrderRepositoryDouble({
  user = userDouble(),
  customer = customerDouble(),
  lots = {},
  number = 1,
} = {}) {
  const calls = {
    created: null,
    history: [],
    items: [],
    allocations: [],
    reserved: [],
    lotsQueries: [],
  };
  const repository = {
    transaction: jest.fn(async (callback) =>
      callback({ LOCK: { UPDATE: "UPDATE" } }),
    ),
    findUserById: jest.fn().mockResolvedValue(user),
    findCustomerById: jest.fn().mockResolvedValue(customer),
    findLotsForUpdate: jest.fn(async (productId, itemStateId) => {
      calls.lotsQueries.push({ productId, itemStateId });

      return lots[`${productId}:${itemStateId}`] ?? [];
    }),
    reserveLot: jest.fn(async (lot, quantity) => {
      calls.reserved.push({ lotId: lot.id, quantity });
      lot.reserved = Number(lot.reserved) + quantity;
    }),
    nextNumber: jest.fn().mockResolvedValue(number),
    createOrder: jest.fn(async (values) => {
      calls.created = values;

      return { id: 10, ...values };
    }),
    createItems: jest.fn(async (rows) => {
      calls.items = rows;

      return rows.map((row, index) => ({ id: 20 + index, ...row }));
    }),
    createAllocations: jest.fn(async (rows) => {
      calls.allocations.push(...rows);

      return rows;
    }),
    createHistory: jest.fn(async (values) => {
      calls.history.push(values);

      return values;
    }),
    findById: jest.fn(async (id) => ({ id, number, items: [], history: [] })),
  };

  return { repository, calls };
}

/**
 * Builds a price resolver double. The default returns `14.29` for every line.
 * @param {Function} [implementation] - Custom resolver implementation.
 * @returns {jest.Mock} The resolver double.
 */
function createPriceResolverDouble(implementation) {
  return jest.fn(
    implementation ??
      (async ({ product_id, item_state_id, price_list_id }) => ({
        product_id,
        item_state_id,
        price_list_id,
        price: 14.29,
        currency: TRANSACTION_CURRENCY,
      })),
  );
}

module.exports = {
  TRANSACTION_CURRENCY,
  createOrderRepositoryDouble,
  createPriceResolverDouble,
  customerDouble,
  lotDouble,
  userDouble,
};
