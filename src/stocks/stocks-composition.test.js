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

beforeEach(() => {
  Stock.findAll.mockReset();
  Stock.findByPk.mockReset();
  User.findByPk.mockReset();
  User.findByPk.mockResolvedValue({
    id: 1,
    username: "admin",
    isBlocked: false,
  });
});

describe("stocks router read-only composition", () => {
  it("mounts the list, available and detail routers in order", async () => {
    Stock.findAll.mockResolvedValueOnce([]);
    Stock.findAll.mockResolvedValueOnce([]);
    Stock.findByPk.mockResolvedValueOnce({
      id: 1,
      product_id: 15,
      item_state_id: 1,
      quantity: 3,
      item_state: {
        id: 1,
        name: "sellable",
        label: "Vendible",
        is_sellable: true,
      },
    });
    const token = tokenFor("manager_warehouse");

    const list = await request(app)
      .get("/stocks")
      .set("Authorization", `Bearer ${token}`);
    const available = await request(app)
      .get("/stocks/available?product_id=15")
      .set("Authorization", `Bearer ${token}`);
    const detail = await request(app)
      .get("/stocks/1")
      .set("Authorization", `Bearer ${token}`);

    expect(list.status).toBe(200);
    expect(available.status).toBe(200);
    expect(detail.status).toBe(200);
    expect(Stock.findAll).toHaveBeenCalledTimes(2);
    expect(Stock.findByPk).toHaveBeenCalledTimes(1);
  });
});
