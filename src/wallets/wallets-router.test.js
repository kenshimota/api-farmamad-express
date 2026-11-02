process.env.JWT_SECRET = "test-secret";

jest.mock("../models/user", () => ({ findByPk: jest.fn() }));
jest.mock("./service", () => ({
  walletService: {
    listWallets: jest.fn(),
    getWallet: jest.fn(),
    listTransactions: jest.fn(),
  },
}));

const express = require("express");
const request = require("supertest");
const jwt = require("jsonwebtoken");
const User = require("../models/user");
const { walletService } = require("./service");
const walletsRouter = require("./index");
const app = express();
app.use("/customer-wallets", walletsRouter);
app.use((error, req, res, next) => {
  res.status(500).json({ message: "Internal server error" });
});

const SECRET = "test-secret";
const CURRENCY = { id: 2, code: "USDT", name: "Tether", symbol: "$" };
const WALLET = {
  id: 5,
  customer_id: 8,
  currency_id: 2,
  currency: CURRENCY,
  balance: "100.00",
};
const TRANSACTION = {
  id: 1,
  transaction_type: "deposit",
  amount: "100.00",
  balance_after: "100.00",
  payment_id: 1,
  invoice_id: null,
  payment_allocation_id: null,
  description: "Depósito",
  createdAt: new Date("2026-11-01T12:00:00.000Z"),
  wallet: { id: 5, currency_id: 2, currency: CURRENCY },
  created_by: { id: 1, username: "maria", email: "maria@farmamad.com" },
};

/**
 * Signs a JWT for a role.
 * @param {string} role - Role name.
 * @returns {string} Signed token.
 */
function tokenFor(role) {
  return jwt.sign({ sub: 1, username: "user", role }, SECRET, {
    expiresIn: "1h",
  });
}

/**
 * Returns a user row for the given role.
 * @param {string} role - Role name.
 * @param {object} [overrides] - Attribute overrides.
 * @returns {object} User row.
 */
function userFor(role, overrides = {}) {
  return {
    id: 1,
    role: { name: role },
    customer_id: role === "customer" ? 8 : null,
    isBlocked: false,
    ...overrides,
  };
}

/**
 * Sends an authenticated request.
 * @param {string} method - HTTP method.
 * @param {string} path - Request path.
 * @param {string|null} token - Bearer token.
 * @returns {Promise<import("supertest").Response>} Response.
 */
function send(method, path, token = tokenFor("admin")) {
  const req = request(app)[method](path);

  return token ? req.set("Authorization", `Bearer ${token}`) : req;
}

beforeEach(() => {
  User.findByPk.mockResolvedValue(userFor("admin"));
  walletService.listWallets.mockResolvedValue([WALLET]);
  walletService.getWallet.mockResolvedValue(WALLET);
  walletService.listTransactions.mockResolvedValue([TRANSACTION]);
});

describe("GET /customer-wallets", () => {
  it("lists the wallets requested by staff", async () => {
    const response = await send(
      "get",
      "/customer-wallets?customer_id=8",
      tokenFor("seller"),
    );

    expect(response.status).toBe(200);
    expect(response.body).toEqual([
      {
        id: 5,
        customer_id: 8,
        currency_id: 2,
        currency: CURRENCY,
        balance: 100,
      },
    ]);
    expect(walletService.listWallets).toHaveBeenCalledWith(8);
  });

  it("lets a customer omit customer_id and uses its own", async () => {
    User.findByPk.mockResolvedValue(userFor("customer"));

    const response = await send(
      "get",
      "/customer-wallets",
      tokenFor("customer"),
    );

    expect(response.status).toBe(200);
    expect(walletService.listWallets).toHaveBeenCalledWith(8);
  });

  it("responds 403 when a customer asks for another customer", async () => {
    User.findByPk.mockResolvedValue(userFor("customer"));

    const response = await send(
      "get",
      "/customer-wallets?customer_id=9",
      tokenFor("customer"),
    );

    expect(response.status).toBe(403);
    expect(response.body).toEqual({ message: "Forbidden" });
    expect(walletService.listWallets).not.toHaveBeenCalled();
  });

  it("responds 403 when the customer profile is not linked", async () => {
    User.findByPk.mockResolvedValue(userFor("customer", { customer_id: null }));

    const response = await send(
      "get",
      "/customer-wallets",
      tokenFor("customer"),
    );

    expect(response.status).toBe(403);
    expect(response.body).toEqual({
      message: "Customer profile is not linked",
    });
  });

  it("responds 400 when staff omit customer_id", async () => {
    const response = await send("get", "/customer-wallets");

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ message: "customer_id is required" });
  });

  it("responds 422 for a malformed customer_id", async () => {
    const response = await send("get", "/customer-wallets?customer_id=abc");

    expect(response.status).toBe(422);
    expect(response.body).toEqual({
      errors: { customer_id: "Invalid customer_id" },
    });
  });

  it.each(["dispatcher", "support"])("responds 403 for %s", async (role) => {
    User.findByPk.mockResolvedValue(userFor(role));

    const response = await send(
      "get",
      "/customer-wallets?customer_id=8",
      tokenFor(role),
    );

    expect(response.status).toBe(403);
  });

  it("responds 401 without a token", async () => {
    const response = await send("get", "/customer-wallets?customer_id=8", null);

    expect(response.status).toBe(401);
  });
});

describe("GET /customer-wallets/:id", () => {
  it("returns the wallet to staff", async () => {
    const response = await send("get", "/customer-wallets/5");

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ id: 5, balance: 100 });
  });

  it("returns the wallet to its customer owner", async () => {
    User.findByPk.mockResolvedValue(userFor("customer"));

    const response = await send(
      "get",
      "/customer-wallets/5",
      tokenFor("customer"),
    );

    expect(response.status).toBe(200);
  });

  it("hides another customer's wallet with 404", async () => {
    User.findByPk.mockResolvedValue(userFor("customer"));
    walletService.getWallet.mockResolvedValue({ ...WALLET, customer_id: 9 });

    const response = await send(
      "get",
      "/customer-wallets/5",
      tokenFor("customer"),
    );

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ message: "Wallet not found" });
  });

  it("responds 403 for an unlinked customer", async () => {
    User.findByPk.mockResolvedValue(userFor("customer", { customer_id: null }));

    const response = await send(
      "get",
      "/customer-wallets/5",
      tokenFor("customer"),
    );

    expect(response.status).toBe(403);
  });

  it.each(["abc", "0", "1.5"])("responds 422 for the id %s", async (id) => {
    const response = await send("get", `/customer-wallets/${id}`);

    expect(response.status).toBe(422);
    expect(response.body).toEqual({ errors: { id: "Invalid wallet id" } });
  });

  it("responds 404 for an unknown wallet", async () => {
    walletService.getWallet.mockResolvedValue(null);

    const response = await send("get", "/customer-wallets/999");

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ message: "Wallet not found" });
  });
});

describe("GET /customer-wallets/:id/transactions", () => {
  it("includes created_by for staff", async () => {
    const response = await send("get", "/customer-wallets/5/transactions");

    expect(response.status).toBe(200);
    expect(response.body[0]).toMatchObject({
      id: 1,
      amount: 100,
      currency: CURRENCY,
      created_by: { id: 1, username: "maria" },
    });
    expect(walletService.listTransactions).toHaveBeenCalledWith(5, {
      includeCreatedBy: true,
    });
  });

  it("hides created_by from the customer", async () => {
    User.findByPk.mockResolvedValue(userFor("customer"));

    const response = await send(
      "get",
      "/customer-wallets/5/transactions",
      tokenFor("customer"),
    );

    expect(response.status).toBe(200);
    expect(response.body[0]).not.toHaveProperty("created_by");
    expect(walletService.listTransactions).toHaveBeenCalledWith(5, {
      includeCreatedBy: false,
    });
  });

  it("responds 404 for another customer's wallet", async () => {
    User.findByPk.mockResolvedValue(userFor("customer"));
    walletService.getWallet.mockResolvedValue({ ...WALLET, customer_id: 9 });

    const response = await send(
      "get",
      "/customer-wallets/5/transactions",
      tokenFor("customer"),
    );

    expect(response.status).toBe(404);
    expect(walletService.listTransactions).not.toHaveBeenCalled();
  });
});
