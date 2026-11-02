/**
 * Jest module doubles required by `src/app.test.js`. They are registered from
 * this helper before the app is loaded, keeping the test file focused on the
 * HTTP behaviour.
 */
jest.mock("../../src/database", () => ({
  authenticate: jest.fn().mockResolvedValue(),
  transaction: jest.fn(),
}));
jest.mock("../../src/models/user", () => ({
  findOne: jest.fn(),
  findByPk: jest.fn(),
  count: jest.fn(),
  create: jest.fn(),
}));
jest.mock("../../src/models/role", () => ({
  findOne: jest.fn(),
  findAll: jest.fn(),
}));
jest.mock("../../src/models/password-reset-code", () => ({
  findOne: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
}));
jest.mock("../../src/models/customer", () => ({
  create: jest.fn(),
  findAll: jest.fn(),
  findByPk: jest.fn(),
}));
jest.mock("../../src/models/price-list", () => ({}));
jest.mock("../../src/models/warehouse", () => ({
  create: jest.fn(),
  findAll: jest.fn(),
  findByPk: jest.fn(),
}));
jest.mock("../../src/models/category", () => ({
  create: jest.fn(),
  findAll: jest.fn(),
  findByPk: jest.fn(),
}));
jest.mock("../../src/models/image", () => ({
  create: jest.fn(),
  findAll: jest.fn(),
  findByPk: jest.fn(),
}));
jest.mock("../../src/models/product", () => ({
  create: jest.fn(),
  findAll: jest.fn(),
  findByPk: jest.fn(),
}));
jest.mock("../../src/models/state", () => ({
  create: jest.fn(),
  findAll: jest.fn(),
  findByPk: jest.fn(),
}));
jest.mock("../../src/models/city", () => ({
  create: jest.fn(),
  findAll: jest.fn(),
  findByPk: jest.fn(),
}));
jest.mock("../../src/models/supplier", () => ({
  create: jest.fn(),
  findAll: jest.fn(),
  findByPk: jest.fn(),
}));
jest.mock("../../src/models/item-state", () => ({
  create: jest.fn(),
  findAll: jest.fn(),
  findByPk: jest.fn(),
}));
jest.mock("../../src/models/cost", () => ({
  create: jest.fn(),
  findAll: jest.fn(),
  findByPk: jest.fn(),
}));
jest.mock("../../src/models/stock", () => ({
  findAll: jest.fn(),
  findByPk: jest.fn(),
  findOne: jest.fn(),
  findOrCreate: jest.fn(),
}));
jest.mock("../../src/models/purchase", () => ({
  create: jest.fn(),
  findAll: jest.fn(),
  findByPk: jest.fn(),
}));
jest.mock("../../src/models/purchase-item", () => ({
  create: jest.fn(),
  bulkCreate: jest.fn(),
  findAll: jest.fn(),
  findOne: jest.fn(),
}));
jest.mock("../../src/models/currency", () => ({
  create: jest.fn(),
  findAll: jest.fn(),
  findByPk: jest.fn(),
}));
jest.mock("../../src/models/currency-rate-history");
jest.mock("../../src/models/shelf");
jest.mock("../../src/models/shelf-section");
jest.mock("../../src/models/lot");
jest.mock("../../src/models/customer-seller");
jest.mock("../../src/models/tax");
jest.mock("../../src/models/method-payment-type");
jest.mock("../../src/models/method-payment", () => ({}));
jest.mock("../../src/models/customer-wallet", () => ({}));
jest.mock("../../src/models/payment", () => ({}));
jest.mock("../../src/models/payment-status", () => ({}));
jest.mock("../../src/models/payment-status-history", () => ({
  belongsTo: jest.fn(),
  hasMany: jest.fn(),
}));
jest.mock("../../src/models/wallet-transaction", () => ({}));
jest.mock("../../src/models/invoice", () => ({
  belongsTo: jest.fn(),
  hasMany: jest.fn(),
}));
jest.mock("../../src/models/invoice-item", () => ({
  belongsTo: jest.fn(),
  hasMany: jest.fn(),
}));
jest.mock("../../src/models/payment-term", () => ({}));
jest.mock("../../src/models/order", () => ({}));
jest.mock("../../src/order-statuses", () => require("express").Router());
jest.mock("../../src/models/payment-allocation", () => ({
  belongsTo: jest.fn(),
  hasMany: jest.fn(),
}));
jest.mock("../../src/orders/service", () => ({
  orderService: { createOrder: jest.fn() },
}));
