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
  tax_rate: "16.00",
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

describe("POST /purchases", () => {
  it.each(["admin", "seller"])(
    "allows a %s to create a purchase and answers 201",
    async (role) => {
      const response = await send(
        "post",
        "/purchases",
        {
          supplier_id: 2,
          tax_rate: 16,
          notes: "Reposición",
          items: [
            {
              product_id: 15,
              item_state_id: 1,
              quantity: 40,
              unit_cost: 20,
            },
          ],
        },
        tokenFor(role),
      );

      expect(response.status).toBe(201);
      expect(response.body).toEqual({
        id: 1,
        number: 1,
        supplier_id: 2,
        currency_id: 3,
        currency: CURRENCY,
        status: "draft",
        subtotal: 800,
        tax_rate: 16,
        tax_amount: 128,
        total: 928,
        notes: null,
        items: [
          {
            id: 1,
            product_id: 15,
            item_state_id: 1,
            quantity: 40,
            unit_cost: 20,
            subtotal: 800,
          },
        ],
      });
      expect(purchaseService.createPurchase).toHaveBeenCalledWith({
        supplier_id: 2,
        tax_rate: 16,
        notes: "Reposición",
        items: [
          { product_id: 15, item_state_id: 1, quantity: 40, unit_cost: 20 },
        ],
      });
      expect(response.body).not.toHaveProperty("createdAt");
      expect(response.body).not.toHaveProperty("updatedAt");
    },
  );

  it("ignores server-owned fields and defaults the items to an empty array", async () => {
    await send("post", "/purchases", {
      supplier_id: 2,
      number: 99,
      status: "confirmed",
      subtotal: 1,
      tax_amount: 1,
      total: 2,
      confirmed_at: "2026-10-01",
    });

    expect(purchaseService.createPurchase).toHaveBeenCalledWith({
      supplier_id: 2,
      items: [],
    });
  });

  it.each([
    [{}, "supplier_id is required"],
    [{ supplier_id: null }, "supplier_id is required"],
  ])(
    "responds 400 when supplier_id is missing in %p",
    async (body, message) => {
      const response = await send("post", "/purchases", body);

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ message });
      expect(purchaseService.createPurchase).not.toHaveBeenCalled();
    },
  );

  it.each([
    { supplier_id: 2, tax_rate: 101 },
    { supplier_id: 2, tax_rate: 16.123 },
    { supplier_id: 2, notes: "x".repeat(1001) },
    { supplier_id: 2, items: "nope" },
    {
      supplier_id: 2,
      items: [{ product_id: 15, item_state_id: 1, quantity: 0, unit_cost: 10 }],
    },
    {
      supplier_id: 2,
      items: [
        { product_id: 15, item_state_id: 1, quantity: 1, unit_cost: 12.345 },
      ],
    },
  ])("responds 422 for invalid body %p", async (body) => {
    const response = await send("post", "/purchases", body);

    expect(response.status).toBe(422);
    expect(response.body.errors).toBeDefined();
    expect(purchaseService.createPurchase).not.toHaveBeenCalled();
  });

  it("maps service conflicts and validation errors", async () => {
    purchaseService.createPurchase.mockRejectedValueOnce({
      status: 409,
      body: { message: "Item already exists" },
    });

    const conflict = await send("post", "/purchases", { supplier_id: 2 });
    expect(conflict.status).toBe(409);
    expect(conflict.body).toEqual({ message: "Item already exists" });

    purchaseService.createPurchase.mockRejectedValueOnce({
      status: 422,
      body: { errors: { supplier_id: "Invalid supplier id" } },
    });

    const invalid = await send("post", "/purchases", { supplier_id: 99 });
    expect(invalid.status).toBe(422);
    expect(invalid.body).toEqual({
      errors: { supplier_id: "Invalid supplier id" },
    });
  });

  it("responds 401 and 403 for unauthorized callers", async () => {
    const anonymous = await send(
      "post",
      "/purchases",
      { supplier_id: 2 },
      null,
    );
    expect(anonymous.status).toBe(401);
    expect(anonymous.body).toEqual({ message: "Unauthorized" });

    const forbidden = await send(
      "post",
      "/purchases",
      { supplier_id: 2 },
      tokenFor("manager_warehouse"),
    );
    expect(forbidden.status).toBe(403);
    expect(forbidden.body).toEqual({ message: "Forbidden" });
  });

  it("responds 403 when the user is blocked", async () => {
    User.findByPk.mockResolvedValue({ ...AUTH_USER, isBlocked: true });

    const response = await send("post", "/purchases", { supplier_id: 2 });

    expect(response.status).toBe(403);
    expect(response.body).toEqual({ message: "User is blocked" });
  });
});
