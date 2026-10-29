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
app.use((req, res) => res.status(404).json({ message: "Not found" }));
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

describe("stocks router composition", () => {
  it("does not expose any public write endpoint", async () => {
    const token = tokenFor("admin");

    for (const method of ["post", "put", "delete"]) {
      const response = await request(app)
        [method]("/stocks/1")
        .set("Authorization", `Bearer ${token}`)
        .send({ quantity: 10 });

      expect(response.status).toBe(404);
    }

    expect(Stock.findAll).not.toHaveBeenCalled();
  });

  it("routes /product/:product_id before the generic detail route", async () => {
    Stock.findAll.mockResolvedValue([]);

    const response = await request(app)
      .get("/stocks/product/15")
      .set("Authorization", `Bearer ${tokenFor("manager_warehouse")}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual([]);
    expect(Stock.findByPk).not.toHaveBeenCalled();
  });

  it("routes /available before the generic detail route", async () => {
    Stock.findAll.mockResolvedValue([]);

    const response = await request(app)
      .get("/stocks/available?product_id=15")
      .set("Authorization", `Bearer ${tokenFor("seller")}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual([]);
    expect(Stock.findByPk).not.toHaveBeenCalled();
  });
});
