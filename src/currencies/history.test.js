process.env.JWT_SECRET = "test-secret";

jest.mock("../models/currency", () => ({
  create: jest.fn(),
  findAll: jest.fn(),
  findByPk: jest.fn(),
}));
jest.mock("../models/currency-rate-history", () => ({
  create: jest.fn(),
  findAll: jest.fn(),
}));
jest.mock("../models/user", () => ({ findByPk: jest.fn() }));

const express = require("express");
const request = require("supertest");
const jwt = require("jsonwebtoken");
const Currency = require("../models/currency");
const CurrencyRateHistory = require("../models/currency-rate-history");
const User = require("../models/user");
const historyRouter = require("./history");

const app = express();
app.use(express.json());
app.use("/currencies", historyRouter);
app.use((error, req, res, next) => {
  res.status(500).json({ message: "Server error" });
});

const SECRET = "test-secret";
const AUTH_USER = { id: 1, username: "admin", isBlocked: false };
const CURRENCY = {
  id: 2,
  code: "USDT",
  name: "Tether",
  symbol: "$",
  rate: "1000.290000",
  is_base: false,
  is_active: true,
};
const HISTORY = {
  id: 5,
  currency_id: 2,
  previous_rate: "1000.290000",
  new_rate: "1005.750000",
  changed_by: {
    id: 1,
    username: "admin",
    email: "admin@farmamad.com",
  },
  changed_at: new Date("2026-10-29T15:30:00.000Z"),
  reason: "Actualización diaria BCV",
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
  jest.clearAllMocks();
  User.findByPk.mockResolvedValue(AUTH_USER);
  Currency.findByPk.mockResolvedValue(CURRENCY);
  CurrencyRateHistory.findAll.mockResolvedValue([HISTORY]);
});

describe("GET /currencies/:id/history", () => {
  it.each(["admin", "seller", "manager_warehouse", "dispatcher"])(
    "allows a %s to read the history",
    async (role) => {
      const response = await get("/currencies/2/history", tokenFor(role));

      expect(response.status).toBe(200);
      expect(response.body).toEqual([
        {
          id: 5,
          currency_id: 2,
          previous_rate: 1000.29,
          new_rate: 1005.75,
          changed_by: {
            id: 1,
            username: "admin",
            email: "admin@farmamad.com",
          },
          changed_at: "2026-10-29T15:30:00.000Z",
          reason: "Actualización diaria BCV",
        },
      ]);
    },
  );

  it("asks the repository for the descending history", async () => {
    const response = await get("/currencies/2/history");

    expect(response.status).toBe(200);
    expect(CurrencyRateHistory.findAll).toHaveBeenCalledWith({
      where: { currency_id: 2 },
      order: [
        ["changed_at", "DESC"],
        ["id", "DESC"],
      ],
      include: [
        {
          model: User,
          as: "changed_by_user",
          attributes: ["id", "username", "email"],
        },
      ],
    });
  });

  it("serializes the seed row with null previous_rate and changed_by", async () => {
    CurrencyRateHistory.findAll.mockResolvedValue([
      {
        ...HISTORY,
        previous_rate: null,
        changed_by: null,
        reason: "seed",
      },
    ]);

    const response = await get("/currencies/2/history");

    expect(response.body[0]).toEqual(
      expect.objectContaining({
        previous_rate: null,
        changed_by: null,
        reason: "seed",
      }),
    );
  });

  it("returns an empty array when there are no rows", async () => {
    CurrencyRateHistory.findAll.mockResolvedValue([]);

    const response = await get("/currencies/2/history");

    expect(response.status).toBe(200);
    expect(response.body).toEqual([]);
  });

  it("responds 404 when the currency does not exist", async () => {
    Currency.findByPk.mockResolvedValue(null);

    const response = await get("/currencies/999/history");

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ message: "Currency not found" });
    expect(CurrencyRateHistory.findAll).not.toHaveBeenCalled();
  });

  it.each(["abc", "0", "-1", "1.5"])(
    "responds 422 when the id is %s",
    async (id) => {
      const response = await get(`/currencies/${id}/history`);

      expect(response.status).toBe(422);
      expect(response.body).toEqual({
        errors: { id: "Invalid currency id" },
      });
      expect(CurrencyRateHistory.findAll).not.toHaveBeenCalled();
    },
  );

  it("responds 401 without a token", async () => {
    const response = await get("/currencies/2/history", null);

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ message: "Unauthorized" });
  });

  it.each(["support", "customer"])("responds 403 for a %s", async (role) => {
    const response = await get("/currencies/2/history", tokenFor(role));

    expect(response.status).toBe(403);
    expect(response.body).toEqual({ message: "Forbidden" });
    expect(CurrencyRateHistory.findAll).not.toHaveBeenCalled();
  });

  it("responds 403 when the authenticated user is blocked", async () => {
    User.findByPk.mockResolvedValue({ ...AUTH_USER, isBlocked: true });

    const response = await get("/currencies/2/history");

    expect(response.status).toBe(403);
    expect(response.body).toEqual({ message: "User is blocked" });
  });
});
