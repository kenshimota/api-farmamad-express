const TRANSACTION = Object.freeze({ LOCK: { UPDATE: "UPDATE" } });

/**
 * Builds a purchase repository double whose methods resolve successful values
 * by default.
 * @param {object} [overrides] - Method overrides.
 * @returns {object} The repository double.
 */
function repositoryDouble(overrides = {}) {
  return {
    transaction: jest.fn((callback) => callback(TRANSACTION)),
    nextNumber: jest.fn().mockResolvedValue(1),
    create: jest.fn(async (values) => ({ id: 1, ...values })),
    list: jest.fn().mockResolvedValue([]),
    findById: jest.fn(),
    findByIdForUpdate: jest.fn(),
    update: jest.fn(async (purchase, values) => {
      Object.assign(purchase, values);
      return purchase;
    }),
    remove: jest.fn(),
    supplierExists: jest.fn().mockResolvedValue(true),
    productExists: jest.fn().mockResolvedValue(true),
    itemStateExists: jest.fn().mockResolvedValue(true),
    upsertCost: jest.fn(),
    ...overrides,
  };
}

/**
 * Builds a purchase item repository double.
 * @param {object} [overrides] - Method overrides.
 * @returns {object} The item repository double.
 */
function itemRepositoryDouble(overrides = {}) {
  return {
    createMany: jest.fn(),
    create: jest.fn(async (values) => ({ id: 4, ...values })),
    list: jest.fn().mockResolvedValue([]),
    findById: jest.fn(),
    findByCombination: jest.fn().mockResolvedValue(null),
    update: jest.fn(async (item, values) => {
      Object.assign(item, values);
      return item;
    }),
    remove: jest.fn(),
    ...overrides,
  };
}

/**
 * Builds the stock purchase service double.
 * @param {object} [overrides] - Method overrides.
 * @returns {object} The stock service double.
 */
function stocksDouble(overrides = {}) {
  return {
    applyPurchaseItems: jest.fn().mockResolvedValue([]),
    ...overrides,
  };
}

module.exports = {
  TRANSACTION,
  itemRepositoryDouble,
  repositoryDouble,
  stocksDouble,
};
