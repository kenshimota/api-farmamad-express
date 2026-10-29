process.env.JWT_SECRET = "test-secret";

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
jest.mock("../../src/models/supplier", () => ({
  create: jest.fn(),
  findAll: jest.fn(),
  findByPk: jest.fn(),
}));
jest.mock("../../src/models/product", () => ({ findByPk: jest.fn() }));
jest.mock("../../src/models/item-state", () => ({ findByPk: jest.fn() }));
jest.mock("../../src/models/cost", () => ({
  findOne: jest.fn(),
  upsert: jest.fn(),
}));
jest.mock("../../src/models/user", () => ({ findByPk: jest.fn() }));
jest.mock("../../src/purchases/purchase-service", () => ({
  purchaseService: {
    listPurchases: jest.fn(),
    getPurchase: jest.fn(),
    createPurchase: jest.fn(),
    updatePurchase: jest.fn(),
    deletePurchase: jest.fn(),
    cancelPurchase: jest.fn(),
    confirmPurchase: jest.fn(),
    listItems: jest.fn(),
    addItem: jest.fn(),
    updateItem: jest.fn(),
    deleteItem: jest.fn(),
  },
}));

const express = require("express");
const request = require("supertest");
const jwt = require("jsonwebtoken");
const User = require("../../src/models/user");
const { purchaseService } = require("../../src/purchases/purchase-service");
const purchasesRouter = require("../../src/purchases/index");

const app = express();
app.use(express.json());
app.use("/purchases", purchasesRouter);
app.use((error, req, res, next) => {
  res.status(500).json({ message: "Server error" });
});

const SECRET = "test-secret";
const AUTH_USER = { id: 1, username: "admin", isBlocked: false };
const ITEM = {
  id: 1,
  purchase_id: 1,
  product_id: 15,
  item_state_id: 1,
  quantity: 40,
  unit_cost: "20.00",
  subtotal: "800.00",
  tax_amount: "128.00",
};
const SUPPLIER = {
  id: 2,
  name: "Distribuidora",
  identification: "J-1",
  email: "ventas@example.com",
  phone: "1234567",
  observations: null,
  address: "Calle 1",
  city_id: 1,
  state_id: 1,
};
const CURRENCY = { id: 3, code: "USD_BCV", name: "Dólar BCV", symbol: "$" };
const PURCHASE = {
  id: 1,
  number: 1,
  supplier_id: 2,
  currency_id: 3,
  currency: CURRENCY,
  status: "draft",
  subtotal: "800.00",
  tax_amount: "128.00",
  total: "928.00",
  notes: null,
  confirmed_at: null,
  items: [ITEM],
};

/**
 * Signs a JWT for the given role.
 * @param {string} [role] - Role name.
 * @returns {string} Signed JWT.
 */
function tokenFor(role = "admin") {
  return jwt.sign({ sub: 1, username: "admin", role }, SECRET, {
    expiresIn: "1h",
  });
}

/**
 * Sends an authenticated request.
 * @param {string} method - HTTP method.
 * @param {string} path - Request path.
 * @param {object} [body] - Request body.
 * @param {string|null} [token] - Bearer token; null omits it.
 * @returns {Promise<import("supertest").Response>} HTTP response.
 */
function send(method, path, body, token = tokenFor()) {
  const req = request(app)[method](path);

  return token
    ? req.set("Authorization", `Bearer ${token}`).send(body)
    : req.send(body);
}

/**
 * Clears the mocks and restores the successful defaults.
 * @returns {void}
 */
function resetPurchaseRouterMocks() {
  jest.clearAllMocks();
  User.findByPk.mockResolvedValue(AUTH_USER);
  purchaseService.listPurchases.mockResolvedValue([PURCHASE]);
  purchaseService.getPurchase.mockResolvedValue({
    ...PURCHASE,
    supplier: SUPPLIER,
  });
  purchaseService.createPurchase.mockResolvedValue(PURCHASE);
}

module.exports = {
  AUTH_USER,
  CURRENCY,
  ITEM,
  PURCHASE,
  SUPPLIER,
  app,
  purchaseService,
  resetPurchaseRouterMocks,
  send,
  tokenFor,
};
