process.env.JWT_SECRET = "test-secret";

jest.mock("../models/user", () => ({ findByPk: jest.fn() }));
jest.mock("./service", () => ({
  invoicePaymentService: {
    applyPayment: jest.fn(),
    listInvoicePayments: jest.fn(),
  },
}));

const express = require("express");
const request = require("supertest");
const jwt = require("jsonwebtoken");
const User = require("../models/user");
const { invoicePaymentService } = require("./service");
const invoicePaymentsRouter = require("./index");

const app = express();
app.use(express.json());
app.use("/invoices", invoicePaymentsRouter);
app.use((error, req, res, next) => {
  res.status(500).json({ message: "Internal server error" });
});

const SECRET = "test-secret";
const AUTH_USER = { id: 1, username: "admin", isBlocked: false };
const NOW = new Date("2026-11-01T13:00:00.000Z");
const CURRENCY = {
  id: 2,
  code: "USDT",
  name: "Tether",
  symbol: "$",
};
const INVOICE = {
  id: 1,
  number: 1,
  total: "25.00",
  paid_amount: "20.00",
  payment_status: "partial",
};
const ALLOCATION = {
  id: 11,
  payment_id: 5,
  invoice_id: 1,
  amount: "10.00",
  applied_amount: "20.00",
  exchange_rate: "2.000000",
  allocated_at: NOW,
  created_by_user_id: 1,
  payment: {
    id: 5,
    currency: CURRENCY,
    method_payment: {
      id: 4,
      label: "Binance Farmamad",
      method_payment_type: { id: 2, code: "BINANCE", name: "Binance" },
    },
  },
  created_by: { id: 1, username: "admin", email: "admin@example.com" },
};

/**
 * Signs a token for the given role.
 * @param {string} role - Role name.
 * @returns {string} The signed JWT.
 */
function tokenFor(role = "admin") {
  return jwt.sign({ sub: 1, username: "admin", role }, SECRET, {
    expiresIn: "1h",
  });
}

/**
 * Sends an authenticated request.
 * @param {string} method - HTTP method.
 * @param {string} path - Request path.
 * @param {string|null} token - Bearer token.
 * @returns {import("supertest").Test} The request.
 */
function send(method, path, token = tokenFor()) {
  const req = request(app)[method](path);

  return token ? req.set("Authorization", `Bearer ${token}`) : req;
}

beforeEach(() => {
  jest.clearAllMocks();
  User.findByPk.mockResolvedValue(AUTH_USER);
  invoicePaymentService.applyPayment.mockResolvedValue({
    allocation: ALLOCATION,
    invoice: INVOICE,
  });
  invoicePaymentService.listInvoicePayments.mockResolvedValue([ALLOCATION]);
});

describe("GET /invoices/:id/payments", () => {
  it("responds 401 without a token", async () => {
    const response = await send("get", "/invoices/1/payments", null);

    expect(response.status).toBe(401);
  });

  it.each(["dispatcher", "manager_warehouse", "support"])(
    "responds 403 for a %s",
    async (role) => {
      const response = await send(
        "get",
        "/invoices/1/payments",
        tokenFor(role),
      );

      expect(response.status).toBe(403);
    },
  );

  it.each(["admin", "seller"])(
    "returns the history with created_by for a %s",
    async (role) => {
      const response = await send(
        "get",
        "/invoices/1/payments",
        tokenFor(role),
      );

      expect(response.status).toBe(200);
      expect(response.body).toEqual([
        expect.objectContaining({
          id: 11,
          payment_id: 5,
          amount: 10,
          applied_amount: 20,
          exchange_rate: 2,
          method_payment: { id: 4, label: "Binance Farmamad" },
          method_payment_type: {
            id: 2,
            code: "BINANCE",
            name: "Binance",
          },
          created_by: {
            id: 1,
            username: "admin",
            email: "admin@example.com",
          },
        }),
      ]);
      expect(invoicePaymentService.listInvoicePayments).toHaveBeenCalledWith(
        1,
        {
          sub: 1,
          username: "admin",
          role,
          iat: expect.any(Number),
          exp: expect.any(Number),
        },
      );
    },
  );

  it("hides created_by from a customer", async () => {
    const response = await send(
      "get",
      "/invoices/1/payments",
      tokenFor("customer"),
    );

    expect(response.status).toBe(200);
    expect(response.body[0]).not.toHaveProperty("created_by");
    expect(response.body[0].created_at).toBeUndefined();
  });

  it("responds 422 for an invalid invoice id", async () => {
    const response = await send("get", "/invoices/abc/payments");

    expect(response.status).toBe(422);
    expect(response.body).toEqual({ errors: { id: "Invalid invoice id" } });
  });

  it.each([
    [403, { message: "Customer profile is not linked" }],
    [404, { message: "Invoice not found" }],
  ])("maps a service %p error", async (status, body) => {
    invoicePaymentService.listInvoicePayments.mockRejectedValue({
      status,
      body,
    });

    const response = await send("get", "/invoices/1/payments");

    expect(response.status).toBe(status);
    expect(response.body).toEqual(body);
  });

  it("forwards unexpected errors to the global handler", async () => {
    invoicePaymentService.listInvoicePayments.mockRejectedValue(
      new Error("boom"),
    );

    const response = await send("get", "/invoices/1/payments");

    expect(response.status).toBe(500);
  });
});
