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
const detailRouter = require("./detail");

const app = express();
app.use(express.json());
app.use("/stocks", detailRouter);
app.use((error, req, res, next) => {
  res.status(500).json({ message: "Server error" });
});

const SECRET = "test-secret";
const AUTH_USER = { id: 1, username: "admin", isBlocked: false };

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
  Stock.findByPk.mockReset();
  User.findByPk.mockReset();
  User.findByPk.mockResolvedValue(AUTH_USER);
});

describe("GET /stocks/:id", () => {
  it("returns one stock with its nested item state", async () => {
    Stock.findByPk.mockResolvedValue({
      id: 1,
      product_id: 15,
      item_state_id: 1,
      quantity: 40,
      item_state: {
        id: 1,
        name: "sellable",
        label: "Vendible",
        is_sellable: true,
      },
    });

    const response = await get("/stocks/1", tokenFor("manager_warehouse"));

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      id: 1,
      product_id: 15,
      item_state_id: 1,
      quantity: 40,
      item_state: {
        id: 1,
        name: "sellable",
        label: "Vendible",
        is_sellable: true,
      },
    });
  });

  it("responds 404 when the stock does not exist", async () => {
    Stock.findByPk.mockResolvedValue(null);

    const response = await get("/stocks/999");

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ message: "Stock not found" });
  });

  it.each(["abc", "0", "-1", "1.5"])(
    "responds 422 when the id is %s",
    async (id) => {
      const response = await get(`/stocks/${id}`);

      expect(response.status).toBe(422);
      expect(response.body).toEqual({ errors: { id: "Invalid stock id" } });
      expect(Stock.findByPk).not.toHaveBeenCalled();
    },
  );

  it("responds 401 without a token", async () => {
    const response = await get("/stocks/1", null);

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ message: "Unauthorized" });
  });

  it.each(["dispatcher", "support", "customer"])(
    "responds 403 for a %s",
    async (role) => {
      const response = await get("/stocks/1", tokenFor(role));

      expect(response.status).toBe(403);
      expect(response.body).toEqual({ message: "Forbidden" });
      expect(Stock.findByPk).not.toHaveBeenCalled();
    },
  );
});
