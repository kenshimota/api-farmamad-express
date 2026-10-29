process.env.JWT_SECRET = "test-secret";

jest.mock("../models/purchase", () => ({
  create: jest.fn(),
  findAll: jest.fn(),
  findByPk: jest.fn(),
}));
jest.mock("../models/purchase-item", () => ({
  create: jest.fn(),
  bulkCreate: jest.fn(),
  findAll: jest.fn(),
  findOne: jest.fn(),
}));
jest.mock("../models/supplier", () => ({
  create: jest.fn(),
  findAll: jest.fn(),
  findByPk: jest.fn(),
}));
jest.mock("../models/product", () => ({ findByPk: jest.fn() }));
jest.mock("../models/item-state", () => ({ findByPk: jest.fn() }));
jest.mock("../models/cost", () => ({
  findOne: jest.fn(),
  upsert: jest.fn(),
}));
jest.mock("../models/user", () => ({ findByPk: jest.fn() }));
jest.mock("./purchase-service", () => ({
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
const User = require("../models/user");
const { purchaseService } = require("./purchase-service");
const purchasesRouter = require("./index");

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
const CURRENCY = {
  id: 3,
  code: "USD_BCV",
  name: "Dólar BCV",
  symbol: "$",
};
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

beforeEach(() => {
  jest.clearAllMocks();
  User.findByPk.mockResolvedValue(AUTH_USER);
  purchaseService.listPurchases.mockResolvedValue([PURCHASE]);
  purchaseService.getPurchase.mockResolvedValue({
    ...PURCHASE,
    supplier: SUPPLIER,
  });
  purchaseService.createPurchase.mockResolvedValue(PURCHASE);
});

describe("GET /purchases", () => {
  it("lists purchases with filters and serializes the totals as numbers", async () => {
    const response = await send(
      "get",
      "/purchases?supplier_id=2&status=draft&number=1",
      undefined,
      tokenFor("manager_warehouse"),
    );

    expect(response.status).toBe(200);
    expect(response.body).toEqual([
      {
        id: 1,
        number: 1,
        supplier_id: 2,
        currency_id: 3,
        currency: CURRENCY,
        status: "draft",
        subtotal: 800,
        tax_amount: 128,
        total: 928,
        notes: null,
      },
    ]);
    expect(purchaseService.listPurchases).toHaveBeenCalledWith({
      supplierId: 2,
      status: "draft",
      number: 1,
      includeItems: false,
    });
  });

  it("nests the items when include=items is requested", async () => {
    const response = await send(
      "get",
      "/purchases?include=items",
      undefined,
      tokenFor("seller"),
    );

    expect(response.status).toBe(200);
    expect(response.body[0].items).toEqual([
      {
        id: 1,
        product_id: 15,
        item_state_id: 1,
        quantity: 40,
        unit_cost: 20,
        subtotal: 800,
        tax_amount: 128,
        total: 928,
      },
    ]);
    expect(purchaseService.listPurchases).toHaveBeenCalledWith({
      includeItems: true,
    });
  });

  it("filters by currency_id", async () => {
    const response = await send(
      "get",
      "/purchases?currency_id=3",
      undefined,
      tokenFor("admin"),
    );

    expect(response.status).toBe(200);
    expect(purchaseService.listPurchases).toHaveBeenCalledWith({
      currencyId: 3,
      includeItems: false,
    });
  });

  it.each([
    ["supplier_id=abc", { supplier_id: "Invalid supplier id" }],
    ["status=paid", { status: "Invalid status" }],
    ["number=abc", { number: "Invalid number" }],
    ["currency_id=abc", { currency_id: "Invalid currency id" }],
  ])("responds 422 for an invalid %s filter", async (query, errors) => {
    const response = await send(
      "get",
      `/purchases?${query}`,
      undefined,
      tokenFor("admin"),
    );

    expect(response.status).toBe(422);
    expect(response.body).toEqual({ errors });
  });

  it("responds 401 and 403 for unauthorized readers", async () => {
    const anonymous = await send("get", "/purchases", undefined, null);
    expect(anonymous.status).toBe(401);

    const forbidden = await send(
      "get",
      "/purchases",
      undefined,
      tokenFor("dispatcher"),
    );
    expect(forbidden.status).toBe(403);
  });
});

describe("GET /purchases/:id", () => {
  it("returns the detail with items and the nested supplier", async () => {
    const response = await send(
      "get",
      "/purchases/1",
      undefined,
      tokenFor("manager_warehouse"),
    );

    expect(response.status).toBe(200);
    expect(response.body.supplier).toEqual(SUPPLIER);
    expect(response.body.items).toHaveLength(1);
    expect(purchaseService.getPurchase).toHaveBeenCalledWith(1);
  });

  it("responds 422 for an invalid id and 404 for an unknown purchase", async () => {
    const invalid = await send("get", "/purchases/abc");
    expect(invalid.status).toBe(422);
    expect(invalid.body).toEqual({ errors: { id: "Invalid purchase id" } });

    purchaseService.getPurchase.mockRejectedValueOnce({
      status: 404,
      body: { message: "Purchase not found" },
    });
    const missing = await send("get", "/purchases/99");
    expect(missing.status).toBe(404);
    expect(missing.body).toEqual({ message: "Purchase not found" });
  });
});
