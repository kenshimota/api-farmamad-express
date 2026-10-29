process.env.JWT_SECRET = "test-secret";

jest.mock("../models/cost", () => ({
  findAll: jest.fn(),
  findByPk: jest.fn(),
}));
jest.mock("../models/product", () => ({ findByPk: jest.fn() }));
jest.mock("../models/item-state", () => ({ findByPk: jest.fn() }));
jest.mock("../models/currency", () => ({ findOne: jest.fn() }));
jest.mock("../models/user", () => ({ findByPk: jest.fn() }));

const express = require("express");
const request = require("supertest");
const jwt = require("jsonwebtoken");
const { UniqueConstraintError } = require("sequelize");
const Cost = require("../models/cost");
const Product = require("../models/product");
const ItemState = require("../models/item-state");
const Currency = require("../models/currency");
const User = require("../models/user");
const updateRouter = require("./update");

const app = express();
app.use(express.json());
app.use("/costs", updateRouter);
app.use((error, req, res, next) => {
  res.status(500).json({ message: "Server error" });
});

const SECRET = "test-secret";
const AUTH_USER = { id: 1, username: "admin", isBlocked: false };
const ITEM_STATE = {
  id: 2,
  name: "damaged",
  label: "Maltratado",
  is_sellable: false,
};
const CURRENCY = { id: 1, code: "USD_BCV", name: "Dólar BCV", symbol: "$" };

/**
 * Signs a JWT for the given role.
 * @param {string} [role] - Role name to embed in the token.
 * @returns {string} Signed JWT.
 */
function tokenFor(role = "admin") {
  return jwt.sign({ sub: 1, username: "admin", role }, SECRET, {
    expiresIn: "1h",
  });
}

/**
 * Builds a stored cost double with a working update method.
 * @param {object} [overrides] - Attribute overrides.
 * @returns {object} Stored cost double.
 */
function target(overrides = {}) {
  return {
    id: 1,
    product_id: 15,
    item_state_id: 2,
    cost: "12.50",
    currency_id: 1,
    currency: CURRENCY,
    item_state: ITEM_STATE,
    update: jest.fn(function update(values) {
      Object.assign(this, values);
      return Promise.resolve(this);
    }),
    ...overrides,
  };
}

/**
 * Sends a PUT /costs/:id request.
 * @param {string} id - Route parameter.
 * @param {object} body - Request body.
 * @param {string|null} [token] - Bearer token, null to omit the header.
 * @returns {Promise<import("supertest").Response>} HTTP response.
 */
function put(id, body, token = tokenFor()) {
  const req = request(app).put(`/costs/${id}`);

  return token
    ? req.set("Authorization", `Bearer ${token}`).send(body)
    : req.send(body);
}

beforeEach(() => {
  Cost.findAll.mockReset();
  Cost.findByPk.mockReset();
  Product.findByPk.mockReset();
  ItemState.findByPk.mockReset();
  Currency.findOne.mockReset();
  User.findByPk.mockReset();
  Product.findByPk.mockResolvedValue({ id: 15 });
  ItemState.findByPk.mockResolvedValue(ITEM_STATE);
  Currency.findOne.mockResolvedValue(CURRENCY);
  User.findByPk.mockResolvedValue(AUTH_USER);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe("PUT /costs/:id", () => {
  it.each(["admin", "seller"])(
    "allows a %s to update the cost and answers 202",
    async (role) => {
      const stored = target();
      Cost.findByPk.mockResolvedValue(stored);

      const response = await put("1", { cost: 20 }, tokenFor(role));

      expect(response.status).toBe(202);
      expect(stored.update).toHaveBeenCalledWith({ cost: 20 });
      expect(response.body).toEqual({
        id: 1,
        product_id: 15,
        item_state_id: 2,
        cost: 20,
        currency_id: 1,
        currency: CURRENCY,
        item_state: ITEM_STATE,
      });
      expect(response.body).not.toHaveProperty("createdAt");
      expect(response.body).not.toHaveProperty("updatedAt");
    },
  );

  it("updates the product and item state when provided", async () => {
    const stored = target();
    const sellable = {
      id: 1,
      name: "sellable",
      label: "Vendible",
      is_sellable: true,
    };
    Cost.findByPk.mockResolvedValueOnce(stored).mockResolvedValueOnce({
      ...stored,
      product_id: 20,
      item_state_id: 1,
      item_state: sellable,
    });

    const response = await put("1", { product_id: 20, item_state_id: 1 });

    expect(response.status).toBe(202);
    expect(stored.update).toHaveBeenCalledWith({
      product_id: 20,
      item_state_id: 1,
    });
    expect(response.body).toEqual(
      expect.objectContaining({ product_id: 20, item_state_id: 1 }),
    );
  });

  it("drops unknown and audit fields", async () => {
    const stored = target();
    Cost.findByPk.mockResolvedValue(stored);

    const response = await put("1", {
      cost: 20,
      id: 99,
      createdAt: "2026-09-01",
      updatedAt: "2026-09-01",
      admin: true,
    });

    expect(response.status).toBe(202);
    expect(stored.update).toHaveBeenCalledWith({ cost: 20 });
  });

  it("responds 409 when the new combination already exists", async () => {
    const stored = target();
    stored.update.mockRejectedValue(
      new UniqueConstraintError({ message: "duplicate" }),
    );
    Cost.findByPk.mockResolvedValue(stored);

    const response = await put("1", { product_id: 20, item_state_id: 1 });

    expect(response.status).toBe(409);
    expect(response.body).toEqual({ message: "Cost already exists" });
  });

  it("responds 422 when a new product does not exist", async () => {
    const stored = target();
    Product.findByPk.mockResolvedValue(null);
    Cost.findByPk.mockResolvedValue(stored);

    const response = await put("1", { product_id: 99 });

    expect(response.status).toBe(422);
    expect(response.body).toEqual({
      errors: { product_id: "Invalid product" },
    });
    expect(stored.update).not.toHaveBeenCalled();
  });

  it("responds 422 when a new item state does not exist", async () => {
    const stored = target();
    ItemState.findByPk.mockResolvedValue(null);
    Cost.findByPk.mockResolvedValue(stored);

    const response = await put("1", { item_state_id: 99 });

    expect(response.status).toBe(422);
    expect(response.body).toEqual({
      errors: { item_state_id: "Invalid item state" },
    });
    expect(stored.update).not.toHaveBeenCalled();
  });

  it.each([
    [{ cost: -1 }, { cost: "cost must be >= 0" }],
    [{ cost: 12.345 }, { cost: "cost must have at most 2 decimals" }],
    [{ cost: 1000000000 }, { cost: "cost must have at most 9 integer digits" }],
    [{ product_id: 0 }, { product_id: "Invalid product" }],
    [{ item_state_id: 0 }, { item_state_id: "Invalid item state" }],
  ])("responds 422 when the body is invalid in %p", async (body, errors) => {
    const response = await put("1", body);

    expect(response.status).toBe(422);
    expect(response.body).toEqual({ errors });
    expect(Cost.findByPk).not.toHaveBeenCalled();
  });

  it("responds 400 when no field is provided", async () => {
    const response = await put("1", {});

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      message: "at least one field is required",
    });
    expect(Cost.findByPk).not.toHaveBeenCalled();
  });

  it("responds 404 when the cost does not exist", async () => {
    Cost.findByPk.mockResolvedValue(null);

    const response = await put("999", { cost: 20 });

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ message: "Cost not found" });
  });

  it.each(["abc", "0", "-1", "1.5"])(
    "responds 422 when the id is %s",
    async (id) => {
      const response = await put(id, { cost: 20 });

      expect(response.status).toBe(422);
      expect(response.body).toEqual({ errors: { id: "Invalid cost id" } });
      expect(Cost.findByPk).not.toHaveBeenCalled();
    },
  );

  it("responds 401 when the token is missing", async () => {
    const response = await put("1", { cost: 20 }, null);

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ message: "Unauthorized" });
    expect(Cost.findByPk).not.toHaveBeenCalled();
  });

  it.each(["dispatcher", "manager_warehouse", "support", "customer"])(
    "responds 403 when the authenticated user is %s",
    async (role) => {
      const response = await put("1", { cost: 20 }, tokenFor(role));

      expect(response.status).toBe(403);
      expect(response.body).toEqual({ message: "Forbidden" });
      expect(Cost.findByPk).not.toHaveBeenCalled();
    },
  );

  it("responds 403 when the authenticated user is blocked", async () => {
    User.findByPk.mockResolvedValue({ ...AUTH_USER, isBlocked: true });

    const response = await put("1", { cost: 20 });

    expect(response.status).toBe(403);
    expect(response.body).toEqual({ message: "User is blocked" });
  });

  it("forwards unexpected persistence errors", async () => {
    const stored = target();
    stored.update.mockRejectedValue(new Error("database exploded"));
    Cost.findByPk.mockResolvedValue(stored);

    const response = await put("1", { cost: 20 });

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ message: "Server error" });
  });
});
