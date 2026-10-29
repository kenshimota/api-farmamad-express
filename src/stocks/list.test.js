process.env.JWT_SECRET = "test-secret";

jest.mock("../models/stock", () => ({
  findAll: jest.fn(),
  findByPk: jest.fn(),
}));
jest.mock("../models/item-state", () => ({}));
jest.mock("../models/cost", () => ({}));
jest.mock("../models/user", () => ({ findByPk: jest.fn() }));

const express = require("express");
const request = require("supertest");
const jwt = require("jsonwebtoken");
const Stock = require("../models/stock");
const User = require("../models/user");
const stocksRouter = require("./index");

const app = express();
app.use(express.json());
app.use("/stocks", stocksRouter);
app.use((error, req, res, next) => {
  res.status(500).json({ message: "Server error" });
});

const SECRET = "test-secret";
const AUTH_USER = { id: 1, username: "admin", isBlocked: false };
const ITEM_STATE = {
  id: 1,
  name: "sellable",
  label: "Vendible",
  is_sellable: true,
};

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
 * Builds a stored stock returned by Sequelize.
 * @param {object} [overrides] - Attribute overrides.
 * @returns {object} Stored stock double.
 */
function stock(overrides = {}) {
  return {
    id: 3,
    product_id: 15,
    item_state_id: 1,
    quantity: 40,
    item_state: ITEM_STATE,
    ...overrides,
  };
}

/**
 * Sends a GET request with an optional token.
 * @param {string} path - Request path.
 * @param {string|null} [token] - Bearer token, null to omit the header.
 * @returns {Promise<import("supertest").Response>} HTTP response.
 */
function get(path, token = tokenFor()) {
  const req = request(app).get(path);

  return token ? req.set("Authorization", `Bearer ${token}`) : req;
}

beforeEach(() => {
  Stock.findAll.mockReset();
  Stock.findByPk.mockReset();
  User.findByPk.mockReset();
  User.findByPk.mockResolvedValue(AUTH_USER);
});

describe("GET /stocks", () => {
  it.each(["admin", "seller", "manager_warehouse"])(
    "allows a %s to list stocks",
    async (role) => {
      Stock.findAll.mockResolvedValue([stock()]);

      const response = await get("/stocks", tokenFor(role));

      expect(response.status).toBe(200);
      expect(response.body).toEqual([
        {
          id: 3,
          product_id: 15,
          item_state_id: 1,
          quantity: 40,
          item_state: ITEM_STATE,
        },
      ]);
    },
  );

  it("returns an empty array when there is no stock", async () => {
    Stock.findAll.mockResolvedValue([]);

    const response = await get("/stocks");

    expect(response.status).toBe(200);
    expect(response.body).toEqual([]);
  });

  it("passes the optional filters to the repository", async () => {
    Stock.findAll.mockResolvedValue([]);

    await get("/stocks?product_id=15&item_state_id=2&in_stock=true");

    expect(Stock.findAll).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.any(Object) }),
    );
    const [options] = Stock.findAll.mock.calls[0];
    expect(options.where.product_id).toBe(15);
    expect(options.where.item_state_id).toBe(2);
    expect(options.where.quantity).toBeDefined();
  });

  it.each([
    ["product_id=abc", "product_id"],
    ["item_state_id=0", "item_state_id"],
    ["in_stock=maybe", "in_stock"],
  ])("responds 422 for the invalid filter %s", async (query, field) => {
    const response = await get(`/stocks?${query}`);

    expect(response.status).toBe(422);
    expect(response.body.errors[field]).toBeDefined();
    expect(Stock.findAll).not.toHaveBeenCalled();
  });

  it("responds 401 without a token", async () => {
    const response = await get("/stocks", null);

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ message: "Unauthorized" });
  });

  it.each(["dispatcher", "support", "customer"])(
    "responds 403 for a %s",
    async (role) => {
      const response = await get("/stocks", tokenFor(role));

      expect(response.status).toBe(403);
      expect(response.body).toEqual({ message: "Forbidden" });
      expect(Stock.findAll).not.toHaveBeenCalled();
    },
  );

  it("responds 403 when the authenticated user is blocked", async () => {
    User.findByPk.mockResolvedValue({ ...AUTH_USER, isBlocked: true });

    const response = await get("/stocks");

    expect(response.status).toBe(403);
    expect(response.body).toEqual({ message: "User is blocked" });
  });
});

describe("GET /stocks/product/:product_id", () => {
  it("returns the stocks of one product", async () => {
    Stock.findAll.mockResolvedValue([stock()]);

    const response = await get(
      "/stocks/product/15",
      tokenFor("manager_warehouse"),
    );

    expect(response.status).toBe(200);
    expect(response.body).toEqual([
      expect.objectContaining({ product_id: 15, quantity: 40 }),
    ]);
    expect(Stock.findAll).toHaveBeenCalledWith(
      expect.objectContaining({ where: { product_id: 15 } }),
    );
  });

  it("returns an empty array when the product has no stock", async () => {
    Stock.findAll.mockResolvedValue([]);

    const response = await get("/stocks/product/15");

    expect(response.status).toBe(200);
    expect(response.body).toEqual([]);
  });

  it.each(["abc", "0", "-1", "1.5"])(
    "responds 422 when the product id is %s",
    async (id) => {
      const response = await get(`/stocks/product/${id}`);

      expect(response.status).toBe(422);
      expect(response.body).toEqual({ errors: { product_id: "Invalid id" } });
      expect(Stock.findAll).not.toHaveBeenCalled();
    },
  );
});
