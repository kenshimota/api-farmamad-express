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
const PURCHASE = {
  id: 1,
  number: 1,
  supplier_id: 2,
  status: "draft",
  subtotal: "20.00",
  tax_rate: "16.00",
  tax_amount: "3.20",
  total: "23.20",
  notes: null,
  confirmed_at: null,
  items: [],
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
  purchaseService.updatePurchase.mockResolvedValue(PURCHASE);
  purchaseService.cancelPurchase.mockResolvedValue(PURCHASE);
  purchaseService.confirmPurchase.mockResolvedValue(PURCHASE);
});

describe("PUT /purchases/:id", () => {
  it.each(["admin", "seller"])(
    "allows a %s to update a draft and answers 202",
    async (role) => {
      const response = await send(
        "put",
        "/purchases/1",
        { tax_rate: 8.25, notes: "Nueva nota" },
        tokenFor(role),
      );

      expect(response.status).toBe(202);
      expect(purchaseService.updatePurchase).toHaveBeenCalledWith(1, {
        tax_rate: 8.25,
        notes: "Nueva nota",
      });
      expect(response.body.total).toBe(23.2);
    },
  );

  it("ignores items and requires at least one editable field", async () => {
    const ignored = await send("put", "/purchases/1", {
      items: [{ product_id: 15 }],
    });

    expect(ignored.status).toBe(400);
    expect(ignored.body).toEqual({ message: "At least one field is required" });
    expect(purchaseService.updatePurchase).not.toHaveBeenCalled();
  });

  it("responds 409 and 404 when the service rejects the update", async () => {
    purchaseService.updatePurchase.mockRejectedValueOnce({
      status: 409,
      body: { message: "Purchase is not editable" },
    });

    const conflict = await send("put", "/purchases/1", { notes: "x" });
    expect(conflict.status).toBe(409);
    expect(conflict.body).toEqual({ message: "Purchase is not editable" });

    purchaseService.updatePurchase.mockRejectedValueOnce({
      status: 404,
      body: { message: "Purchase not found" },
    });

    const missing = await send("put", "/purchases/99", { notes: "x" });
    expect(missing.status).toBe(404);
  });

  it("responds 422 for invalid ids and bodies", async () => {
    const invalidId = await send("put", "/purchases/abc", { notes: "x" });
    expect(invalidId.status).toBe(422);

    const invalidBody = await send("put", "/purchases/1", { tax_rate: 101 });
    expect(invalidBody.status).toBe(422);
  });
});

describe("DELETE /purchases/:id", () => {
  it("deletes a draft and answers 204", async () => {
    purchaseService.deletePurchase.mockResolvedValue();

    const response = await send(
      "delete",
      "/purchases/1",
      undefined,
      tokenFor("seller"),
    );

    expect(response.status).toBe(204);
    expect(response.text).toBe("");
    expect(purchaseService.deletePurchase).toHaveBeenCalledWith(1);
  });

  it("responds 409, 404 and 422", async () => {
    purchaseService.deletePurchase.mockRejectedValueOnce({
      status: 409,
      body: { message: "Purchase is not editable" },
    });
    const conflict = await send("delete", "/purchases/1");
    expect(conflict.status).toBe(409);

    purchaseService.deletePurchase.mockRejectedValueOnce({
      status: 404,
      body: { message: "Purchase not found" },
    });
    const missing = await send("delete", "/purchases/99");
    expect(missing.status).toBe(404);

    const invalid = await send("delete", "/purchases/abc");
    expect(invalid.status).toBe(422);
  });
});

describe("POST /purchases/:id/cancel", () => {
  it("cancels a draft and answers 200", async () => {
    const response = await send("post", "/purchases/1/cancel");

    expect(response.status).toBe(200);
    expect(purchaseService.cancelPurchase).toHaveBeenCalledWith(1);
  });

  it("responds 409 and 404", async () => {
    purchaseService.cancelPurchase.mockRejectedValueOnce({
      status: 409,
      body: { message: "Purchase is not editable" },
    });
    const conflict = await send("post", "/purchases/1/cancel");
    expect(conflict.status).toBe(409);

    purchaseService.cancelPurchase.mockRejectedValueOnce({
      status: 404,
      body: { message: "Purchase not found" },
    });
    const missing = await send("post", "/purchases/99/cancel");
    expect(missing.status).toBe(404);
  });
});

describe("POST /purchases/:id/confirm", () => {
  it("confirms a draft and answers 200", async () => {
    const response = await send(
      "post",
      "/purchases/1/confirm",
      undefined,
      tokenFor("seller"),
    );

    expect(response.status).toBe(200);
    expect(purchaseService.confirmPurchase).toHaveBeenCalledWith(1);
  });

  it("maps the confirmation errors", async () => {
    purchaseService.confirmPurchase.mockRejectedValueOnce({
      status: 409,
      body: { message: "Purchase already confirmed" },
    });
    const conflict = await send("post", "/purchases/1/confirm");
    expect(conflict.status).toBe(409);
    expect(conflict.body).toEqual({ message: "Purchase already confirmed" });

    purchaseService.confirmPurchase.mockRejectedValueOnce({
      status: 422,
      body: { message: "Purchase has no items" },
    });
    const empty = await send("post", "/purchases/1/confirm");
    expect(empty.status).toBe(422);
    expect(empty.body).toEqual({ message: "Purchase has no items" });
  });

  it("responds 401 and 403 for unauthorized roles", async () => {
    const anonymous = await send(
      "post",
      "/purchases/1/confirm",
      undefined,
      null,
    );
    expect(anonymous.status).toBe(401);

    const forbidden = await send(
      "post",
      "/purchases/1/confirm",
      undefined,
      tokenFor("manager_warehouse"),
    );
    expect(forbidden.status).toBe(403);
  });
});
