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
const availableRouter = require("./available");

const app = express();
app.use(express.json());
app.use("/stocks", availableRouter);
app.use((error, req, res, next) => {
  res.status(500).json({ message: "Server error" });
});

const SECRET = "test-secret";
const AUTH_USER = { id: 1, username: "admin", isBlocked: false };
const SELLABLE = {
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
 * Builds an available stock returned by Sequelize.
 * @param {object} [overrides] - Attribute overrides.
 * @returns {object} Stored stock double.
 */
function available(overrides = {}) {
  return {
    id: 3,
    product_id: 15,
    item_state_id: 1,
    quantity: 40,
    cost: { product_id: 15, item_state_id: 1, cost: "20.00" },
    item_state: SELLABLE,
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
  User.findByPk.mockReset();
  User.findByPk.mockResolvedValue(AUTH_USER);
});

describe("GET /stocks/available", () => {
  it.each(["admin", "seller", "manager_warehouse"])(
    "allows a %s to read the sellable stock",
    async (role) => {
      Stock.findAll.mockResolvedValue([available()]);

      const response = await get(
        "/stocks/available?product_id=15",
        tokenFor(role),
      );

      expect(response.status).toBe(200);
      expect(response.body).toEqual([
        {
          product_id: 15,
          item_state_id: 1,
          quantity: 40,
          cost: 20,
          item_state: SELLABLE,
        },
      ]);
      expect(Stock.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ product_id: 15 }),
        }),
      );
    },
  );

  it("keeps the row with cost null when no cost is registered", async () => {
    Stock.findAll.mockResolvedValue([available({ cost: null })]);

    const response = await get("/stocks/available?product_id=15");

    expect(response.status).toBe(200);
    expect(response.body[0].cost).toBeNull();
    expect(response.body[0].quantity).toBe(40);
  });

  it("returns an empty array when nothing is available", async () => {
    Stock.findAll.mockResolvedValue([]);

    const response = await get("/stocks/available?product_id=15");

    expect(response.status).toBe(200);
    expect(response.body).toEqual([]);
  });

  it("supports the /available/:product_id alias", async () => {
    Stock.findAll.mockResolvedValue([available()]);

    const response = await get("/stocks/available/15");

    expect(response.status).toBe(200);
    expect(response.body[0]).toEqual(
      expect.objectContaining({ product_id: 15, cost: 20 }),
    );
    expect(Stock.findAll).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ product_id: 15 }),
      }),
    );
  });

  it.each([
    ["/stocks/available", { product_id: "Invalid id" }],
    ["/stocks/available?product_id=abc", { product_id: "Invalid id" }],
    ["/stocks/available?product_id=0", { product_id: "Invalid id" }],
    ["/stocks/available/abc", { product_id: "Invalid id" }],
  ])("responds 422 for %s", async (path, errors) => {
    const response = await get(path);

    expect(response.status).toBe(422);
    expect(response.body).toEqual({ errors });
    expect(Stock.findAll).not.toHaveBeenCalled();
  });

  it("responds 401 without a token", async () => {
    const response = await get("/stocks/available?product_id=15", null);

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ message: "Unauthorized" });
  });

  it.each(["dispatcher", "support", "customer"])(
    "responds 403 for a %s",
    async (role) => {
      const response = await get(
        "/stocks/available?product_id=15",
        tokenFor(role),
      );

      expect(response.status).toBe(403);
      expect(response.body).toEqual({ message: "Forbidden" });
      expect(Stock.findAll).not.toHaveBeenCalled();
    },
  );
});
