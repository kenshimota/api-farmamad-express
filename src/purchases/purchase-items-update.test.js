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
  id: 4,
  purchase_id: 1,
  product_id: 15,
  item_state_id: 1,
  quantity: 2,
  unit_cost: "10.00",
  subtotal: "20.00",
  tax_amount: "3.20",
};
const PURCHASE = {
  id: 1,
  number: 1,
  supplier_id: 2,
  status: "draft",
  subtotal: "20.00",
  tax_amount: "3.20",
  total: "23.20",
  notes: null,
  items: [ITEM],
};
const BODY = {
  product_id: 15,
  item_state_id: 1,
  quantity: 2,
  unit_cost: 10,
  tax_amount: 3.2,
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
  purchaseService.listItems.mockResolvedValue([ITEM]);
  purchaseService.addItem.mockResolvedValue(PURCHASE);
  purchaseService.updateItem.mockResolvedValue(PURCHASE);
  purchaseService.deleteItem.mockResolvedValue();
});

describe("PUT /purchases/:purchase_id/items/:item_id", () => {
  it("updates a line and answers 202", async () => {
    const response = await send("put", "/purchases/1/items/4", {
      quantity: 3,
      unit_cost: 12.5,
      tax_amount: 6,
    });

    expect(response.status).toBe(202);
    expect(purchaseService.updateItem).toHaveBeenCalledWith(1, 4, {
      quantity: 3,
      unit_cost: 12.5,
      tax_amount: 6,
    });
  });

  it("accepts tax_amount alone and validates its format", async () => {
    const updated = await send("put", "/purchases/1/items/4", {
      tax_amount: 4.5,
    });
    expect(updated.status).toBe(202);
    expect(purchaseService.updateItem).toHaveBeenCalledWith(1, 4, {
      tax_amount: 4.5,
    });

    const negative = await send("put", "/purchases/1/items/4", {
      tax_amount: -1,
    });
    expect(negative.status).toBe(422);

    const decimals = await send("put", "/purchases/1/items/4", {
      tax_amount: 1.234,
    });
    expect(decimals.status).toBe(422);
  });

  it("responds 400 without fields and 422 for invalid ids", async () => {
    const empty = await send("put", "/purchases/1/items/4", {});
    expect(empty.status).toBe(400);
    expect(empty.body).toEqual({ message: "At least one field is required" });

    expect(
      (await send("put", "/purchases/abc/items/4", { quantity: 2 })).status,
    ).toBe(422);
    expect(
      (await send("put", "/purchases/1/items/abc", { quantity: 2 })).status,
    ).toBe(422);
  });

  it("maps item not found and duplicated combinations", async () => {
    purchaseService.updateItem.mockRejectedValueOnce({
      status: 404,
      body: { message: "Item not found" },
    });
    const missing = await send("put", "/purchases/1/items/99", {
      quantity: 2,
    });
    expect(missing.status).toBe(404);

    purchaseService.updateItem.mockRejectedValueOnce({
      status: 409,
      body: { message: "Item already exists" },
    });
    const duplicate = await send("put", "/purchases/1/items/4", {
      product_id: 20,
    });
    expect(duplicate.status).toBe(409);
  });
});

describe("DELETE /purchases/:purchase_id/items/:item_id", () => {
  it("deletes a line and answers 204", async () => {
    const response = await send("delete", "/purchases/1/items/4");

    expect(response.status).toBe(204);
    expect(response.text).toBe("");
    expect(purchaseService.deleteItem).toHaveBeenCalledWith(1, 4);
  });

  it("maps 404, 409 and 422", async () => {
    purchaseService.deleteItem.mockRejectedValueOnce({
      status: 404,
      body: { message: "Item not found" },
    });
    expect((await send("delete", "/purchases/1/items/99")).status).toBe(404);

    purchaseService.deleteItem.mockRejectedValueOnce({
      status: 409,
      body: { message: "Purchase is not editable" },
    });
    expect((await send("delete", "/purchases/1/items/4")).status).toBe(409);

    expect((await send("delete", "/purchases/abc/items/4")).status).toBe(422);
    expect((await send("delete", "/purchases/1/items/abc")).status).toBe(422);
  });
});
