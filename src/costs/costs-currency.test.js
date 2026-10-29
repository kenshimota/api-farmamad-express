process.env.JWT_SECRET = "test-secret";

jest.mock("../models/cost", () => ({
  create: jest.fn(),
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
const Cost = require("../models/cost");
const Product = require("../models/product");
const ItemState = require("../models/item-state");
const Currency = require("../models/currency");
const User = require("../models/user");
const costsRouter = require("./index");

const app = express();
app.use(express.json());
app.use("/costs", costsRouter);
app.use((error, req, res, next) => {
  res.status(500).json({ message: "Server error" });
});

const SECRET = "test-secret";
const AUTH_USER = { id: 1, username: "admin", isBlocked: false };
const BODY = { product_id: 15, item_state_id: 2, cost: 12.5 };
const ITEM_STATE = {
  id: 2,
  name: "damaged",
  label: "Maltratado",
  is_sellable: false,
};
const DEFAULT_CURRENCY = {
  id: 1,
  code: "USD_BCV",
  name: "Dólar BCV",
  symbol: "$",
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
 * Builds a stored cost double.
 * @param {object} [overrides] - Attribute overrides.
 * @returns {object} Cost double.
 */
function storedCost(overrides = {}) {
  return {
    id: 3,
    ...BODY,
    currency_id: 1,
    currency: DEFAULT_CURRENCY,
    item_state: ITEM_STATE,
    ...overrides,
  };
}

/**
 * Builds an updatable cost double.
 * @param {object} [overrides] - Attribute overrides.
 * @returns {object} Cost double.
 */
function target(overrides = {}) {
  return {
    ...storedCost(),
    update: jest.fn(function update(values) {
      Object.assign(this, values);
      return Promise.resolve(this);
    }),
    ...overrides,
  };
}

/**
 * Sends an authenticated request.
 * @param {string} method - HTTP method.
 * @param {string} path - Request path.
 * @param {object} body - Request body.
 * @returns {Promise<import("supertest").Response>} HTTP response.
 */
function send(method, path, body) {
  return request(app)
    [method](path)
    .set("Authorization", `Bearer ${tokenFor()}`)
    .send(body);
}

beforeEach(() => {
  jest.clearAllMocks();
  Product.findByPk.mockResolvedValue({ id: 15 });
  ItemState.findByPk.mockResolvedValue(ITEM_STATE);
  User.findByPk.mockResolvedValue(AUTH_USER);
  Currency.findOne.mockResolvedValue(DEFAULT_CURRENCY);
  Cost.create.mockImplementation(async (values) => ({ id: 3, ...values }));
  Cost.findByPk.mockResolvedValue(storedCost());
});

describe("POST /costs currency", () => {
  it("stores the default currency when currency_id is omitted", async () => {
    const response = await send("post", "/costs", BODY);

    expect(response.status).toBe(201);
    expect(Cost.create).toHaveBeenCalledWith({ ...BODY, currency_id: 1 });
    expect(response.body.currency).toEqual(DEFAULT_CURRENCY);
  });

  it("accepts an explicit active currency", async () => {
    const other = { id: 7, code: "VES", name: "Bolívar", symbol: "Bs" };
    Currency.findOne.mockResolvedValue(other);
    Cost.findByPk.mockResolvedValue(
      storedCost({ currency_id: 7, currency: other }),
    );

    const response = await send("post", "/costs", {
      ...BODY,
      currency_id: 7,
    });

    expect(response.status).toBe(201);
    expect(Cost.create).toHaveBeenCalledWith({ ...BODY, currency_id: 7 });
    expect(response.body.currency_id).toBe(7);
  });

  it("responds 422 for an invalid currency", async () => {
    Currency.findOne.mockResolvedValue(null);

    const response = await send("post", "/costs", {
      ...BODY,
      currency_id: 99,
    });

    expect(response.status).toBe(422);
    expect(response.body).toEqual({
      errors: { currency_id: "Invalid currency" },
    });
    expect(Cost.create).not.toHaveBeenCalled();
  });

  it("responds 503 without a configured default currency", async () => {
    Currency.findOne.mockResolvedValue(null);

    const response = await send("post", "/costs", BODY);

    expect(response.status).toBe(503);
    expect(response.body).toEqual({
      message: "Default transaction currency is not configured",
    });
    expect(Cost.create).not.toHaveBeenCalled();
  });
});

describe("PUT /costs/:id currency", () => {
  it("changes the currency without converting the amount", async () => {
    const stored = target();
    const other = { id: 7, code: "VES", name: "Bolívar", symbol: "Bs" };
    Currency.findOne.mockResolvedValue(other);
    Cost.findByPk.mockResolvedValueOnce(stored).mockResolvedValueOnce({
      ...stored,
      currency_id: 7,
      currency: other,
    });

    const response = await send("put", "/costs/1", { currency_id: 7 });

    expect(response.status).toBe(202);
    expect(stored.update).toHaveBeenCalledWith({ currency_id: 7 });
    expect(response.body.currency_id).toBe(7);
    expect(response.body.cost).toBe(12.5);
  });

  it("responds 422 for an invalid currency", async () => {
    const stored = target();
    Currency.findOne.mockResolvedValue(null);
    Cost.findByPk.mockResolvedValue(stored);

    const response = await send("put", "/costs/1", { currency_id: 99 });

    expect(response.status).toBe(422);
    expect(response.body).toEqual({
      errors: { currency_id: "Invalid currency" },
    });
    expect(stored.update).not.toHaveBeenCalled();
  });
});
