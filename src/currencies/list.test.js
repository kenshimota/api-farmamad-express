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
const User = require("../models/user");
const listRouter = require("./list");

const app = express();
app.use(express.json());
app.use("/currencies", listRouter);
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
  createdAt: new Date("2026-10-29T12:00:00.000Z"),
  updatedAt: new Date("2026-10-29T12:00:00.000Z"),
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

const PUBLIC = {
  id: 2,
  code: "USDT",
  name: "Tether",
  symbol: "$",
  rate: 1000.29,
  is_base: false,
  is_active: true,
};

beforeEach(() => {
  jest.clearAllMocks();
  User.findByPk.mockResolvedValue(AUTH_USER);
  Currency.findAll.mockResolvedValue([CURRENCY]);
  Currency.findByPk.mockResolvedValue(CURRENCY);
});

describe("GET /currencies", () => {
  it.each(["admin", "seller", "manager_warehouse", "dispatcher"])(
    "allows a %s to list currencies",
    async (role) => {
      const response = await get("/currencies", tokenFor(role));

      expect(response.status).toBe(200);
      expect(response.body).toEqual([PUBLIC]);
      expect(response.body[0]).not.toHaveProperty("createdAt");
      expect(response.body[0]).not.toHaveProperty("updatedAt");
    },
  );

  it("lists only active currencies by default", async () => {
    await get("/currencies");

    expect(Currency.findAll).toHaveBeenCalledWith({
      order: [
        ["is_base", "DESC"],
        ["code", "ASC"],
      ],
      where: { is_active: true },
    });
  });

  it("returns an empty array when there are no currencies", async () => {
    Currency.findAll.mockResolvedValue([]);

    const response = await get("/currencies");

    expect(response.status).toBe(200);
    expect(response.body).toEqual([]);
  });

  it("lets an admin include inactive currencies", async () => {
    const response = await get("/currencies?include_inactive=true");

    expect(response.status).toBe(200);
    expect(Currency.findAll).toHaveBeenCalledWith({
      order: [
        ["is_base", "DESC"],
        ["code", "ASC"],
      ],
    });
  });

  it("keeps the default filter when include_inactive=false", async () => {
    await get("/currencies?include_inactive=false");

    expect(Currency.findAll).toHaveBeenCalledWith(
      expect.objectContaining({ where: { is_active: true } }),
    );
  });

  it.each(["seller", "manager_warehouse", "dispatcher"])(
    "responds 403 when a %s asks for inactive currencies",
    async (role) => {
      const response = await get(
        "/currencies?include_inactive=true",
        tokenFor(role),
      );

      expect(response.status).toBe(403);
      expect(response.body).toEqual({ message: "Forbidden" });
      expect(Currency.findAll).not.toHaveBeenCalled();
    },
  );

  it("responds 422 for an invalid include_inactive flag", async () => {
    const response = await get("/currencies?include_inactive=yes");

    expect(response.status).toBe(422);
    expect(response.body).toEqual({
      errors: { include_inactive: "Invalid include_inactive" },
    });
    expect(Currency.findAll).not.toHaveBeenCalled();
  });

  it("responds 401 without a token", async () => {
    const response = await get("/currencies", null);

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ message: "Unauthorized" });
  });

  it.each(["support", "customer"])("responds 403 for a %s", async (role) => {
    const response = await get("/currencies", tokenFor(role));

    expect(response.status).toBe(403);
    expect(response.body).toEqual({ message: "Forbidden" });
    expect(Currency.findAll).not.toHaveBeenCalled();
  });

  it("responds 403 when the authenticated user is blocked", async () => {
    User.findByPk.mockResolvedValue({ ...AUTH_USER, isBlocked: true });

    const response = await get("/currencies");

    expect(response.status).toBe(403);
    expect(response.body).toEqual({ message: "User is blocked" });
  });
});

describe("GET /currencies/:id", () => {
  it("returns one currency for an allowed role", async () => {
    const response = await get("/currencies/2", tokenFor("dispatcher"));

    expect(response.status).toBe(200);
    expect(response.body).toEqual(PUBLIC);
    expect(Currency.findByPk).toHaveBeenCalledWith(2, {
      transaction: undefined,
      lock: undefined,
    });
  });

  it("returns an inactive currency by id", async () => {
    Currency.findByPk.mockResolvedValue({ ...CURRENCY, is_active: false });

    const response = await get("/currencies/2");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ ...PUBLIC, is_active: false });
  });

  it("responds 404 when the currency does not exist", async () => {
    Currency.findByPk.mockResolvedValue(null);

    const response = await get("/currencies/999");

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ message: "Currency not found" });
  });

  it.each(["abc", "0", "-1", "1.5"])(
    "responds 422 when the id is %s",
    async (id) => {
      const response = await get(`/currencies/${id}`);

      expect(response.status).toBe(422);
      expect(response.body).toEqual({
        errors: { id: "Invalid currency id" },
      });
      expect(Currency.findByPk).not.toHaveBeenCalled();
    },
  );
});
