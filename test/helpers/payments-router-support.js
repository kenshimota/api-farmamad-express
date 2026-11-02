process.env.JWT_SECRET = "test-secret";

jest.mock("../../src/models/user", () => ({ findByPk: jest.fn() }));
jest.mock("../../src/payments/service", () => ({
  paymentService: {
    listPayments: jest.fn(),
    getPayment: jest.fn(),
    createPayment: jest.fn(),
    updatePayment: jest.fn(),
    deletePayment: jest.fn(),
  },
}));
jest.mock("../../src/payments/status-service", () => ({
  paymentStatusService: {
    changeStatus: jest.fn(),
    listHistory: jest.fn(),
  },
}));

const express = require("express");
const request = require("supertest");
const jwt = require("jsonwebtoken");
const User = require("../../src/models/user");
const { paymentService } = require("../../src/payments/service");
const { paymentStatusService } = require("../../src/payments/status-service");
const paymentsRouter = require("../../src/payments/index");

const app = express();
app.use(express.json());
app.use("/payments", paymentsRouter);
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
const PAYMENT = {
  id: 1,
  customer_id: 8,
  method_payment_id: 3,
  method_payment: { id: 3, label: "Binance Farmamad" },
  currency_id: 2,
  currency: CURRENCY,
  amount: "100.00",
  paid_at: new Date("2026-11-01T12:00:00.000Z"),
  reference: "TRX-123",
  notes: "Depósito",
  status: "pending",
  status_detail: { code: "pending", name: "Pendiente" },
  rejection_reason: null,
  reference_image_id: null,
  reference_image: null,
  history: [],
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
    username: "user",
    email: "user@farmamad.com",
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
 * @param {object|null} body - Request body.
 * @param {string|null} token - Bearer token.
 * @returns {Promise<import("supertest").Response>} Response.
 */
function send(method, path, body = undefined, token = tokenFor("admin")) {
  const req = request(app)[method](path);

  if (token) {
    req.set("Authorization", `Bearer ${token}`);
  }

  return body === undefined ? req : req.send(body);
}

/**
 * Restores the successful doubles before every test.
 * @returns {void}
 */
function resetMocks() {
  User.findByPk.mockResolvedValue(userFor("admin"));
  paymentService.listPayments.mockResolvedValue([PAYMENT]);
  paymentService.getPayment.mockResolvedValue(PAYMENT);
  paymentService.createPayment.mockResolvedValue({
    payment: PAYMENT,
    wallet: WALLET,
  });
  paymentService.updatePayment.mockResolvedValue(PAYMENT);
  paymentService.deletePayment.mockResolvedValue();
  paymentStatusService.changeStatus.mockResolvedValue({
    payment: { ...PAYMENT, status: "conciliated" },
    wallet: WALLET,
  });
  paymentStatusService.listHistory.mockResolvedValue([
    {
      id: 1,
      from_status: null,
      to_status: "pending",
      reason: null,
      createdAt: new Date("2026-11-01T12:00:00.000Z"),
      actor: { id: 1, username: "user", email: "user@farmamad.com" },
    },
  ]);
}

beforeEach(resetMocks);

module.exports = {
  CURRENCY,
  PAYMENT,
  WALLET,
  app,
  paymentService,
  paymentStatusService,
  resetMocks,
  send,
  tokenFor,
  userFor,
};
