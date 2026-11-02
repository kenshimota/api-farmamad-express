process.env.JWT_SECRET = "test-secret";

jest.mock("../models/user", () => ({ findByPk: jest.fn() }));
jest.mock("./service", () => ({
  invoiceService: {
    listInvoices: jest.fn(),
    getInvoice: jest.fn(),
    getInvoiceByOrder: jest.fn(),
    createInvoice: jest.fn(),
  },
}));

const express = require("express");
const request = require("supertest");
const jwt = require("jsonwebtoken");
const User = require("../models/user");
const { invoiceService } = require("./service");
const invoicesRouter = require("./index");

const app = express();
app.use(express.json());
app.use("/invoices", invoicesRouter);
app.use((error, req, res, next) => {
  res.status(500).json({ message: "Internal server error" });
});

const SECRET = "test-secret";
const AUTH_USER = { id: 1, username: "admin", isBlocked: false };
const INVOICE = {
  id: 1,
  number: 1,
  order_id: 10,
  customer_id: 8,
  currency_id: 3,
  payment_term_id: 3,
  subtotal: "25.00",
  tax_amount: "0.00",
  total: "25.00",
  paid_amount: "0.00",
  payment_status: "pending",
  issued_at: new Date("2026-11-01T12:00:00.000Z"),
  due_date: "2026-11-16",
  notes: null,
  items: [],
  customer: {
    id: 8,
    fullName: "Cliente",
    email: "c@example.com",
    direction: "Calle 1",
  },
  currency: { id: 3, code: "USD_BCV", name: "Dólar BCV", symbol: "$" },
};

function tokenFor(role = "admin") {
  return jwt.sign({ sub: 1, username: "admin", role }, SECRET, {
    expiresIn: "1h",
  });
}

function send(method, path, token = tokenFor()) {
  const req = request(app)[method](path);

  return token ? req.set("Authorization", `Bearer ${token}`) : req;
}

beforeEach(() => {
  jest.clearAllMocks();
  User.findByPk.mockResolvedValue(AUTH_USER);
  invoiceService.listInvoices.mockResolvedValue([INVOICE]);
  invoiceService.getInvoice.mockResolvedValue(INVOICE);
});

describe("GET /invoices", () => {
  it("responds 401 without a token", async () => {
    const response = await send("get", "/invoices", null);

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ message: "Unauthorized" });
  });

  it.each(["customer", "dispatcher", "support", "manager_warehouse"])(
    "responds 403 for a %s",
    async (role) => {
      const response = await send("get", "/invoices", tokenFor(role));

      expect(response.status).toBe(403);
      expect(response.body).toEqual({ message: "Forbidden" });
    },
  );

  it.each(["admin", "seller"])("lists summaries for a %s", async (role) => {
    const response = await send("get", "/invoices", tokenFor(role));

    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(1);
    expect(response.body[0]).not.toHaveProperty("items");
    expect(response.body[0]).not.toHaveProperty("invoiced_by");
    expect(response.body[0]).toMatchObject({
      id: 1,
      balance_due: 25,
    });
  });

  it("parses every exact filter", async () => {
    const response = await send(
      "get",
      "/invoices?order_id=10&customer_id=8&number=1&payment_status=paid",
    );

    expect(response.status).toBe(200);
    expect(invoiceService.listInvoices).toHaveBeenCalledWith({
      orderId: 10,
      customerId: 8,
      number: 1,
      paymentStatus: "paid",
    });
  });

  it.each([
    ["order_id=0", { order_id: "Invalid order id" }],
    ["customer_id=x", { customer_id: "Invalid customer id" }],
    ["number=0", { number: "Invalid number" }],
    ["payment_status=cancelled", { payment_status: "Invalid payment status" }],
  ])("responds 422 for the filter %s", async (query, errors) => {
    const response = await send("get", `/invoices?${query}`);

    expect(response.status).toBe(422);
    expect(response.body).toEqual({ errors });
  });
});

describe("GET /invoices/:id", () => {
  it("responds 422 for an invalid id without calling the service", async () => {
    const response = await send("get", "/invoices/abc");

    expect(response.status).toBe(422);
    expect(response.body).toEqual({ errors: { id: "Invalid invoice id" } });
    expect(invoiceService.getInvoice).not.toHaveBeenCalled();
  });

  it("returns the invoice with invoiced_by for an admin", async () => {
    const response = await send("get", "/invoices/1", tokenFor("admin"));

    expect(response.status).toBe(200);
    expect(response.body.items).toEqual([]);
    expect(invoiceService.getInvoice).toHaveBeenCalledWith(1, {
      sub: 1,
      username: "admin",
      role: "admin",
      iat: expect.any(Number),
      exp: expect.any(Number),
    });
  });

  it("returns the invoice without invoiced_by for a customer", async () => {
    const response = await send("get", "/invoices/1", tokenFor("customer"));

    expect(response.status).toBe(200);
    expect(response.body).not.toHaveProperty("invoiced_by");
  });

  it("responds 404 when the service reports a missing invoice", async () => {
    invoiceService.getInvoice.mockRejectedValue({
      status: 404,
      body: { message: "Invoice not found" },
    });

    const response = await send("get", "/invoices/99");

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ message: "Invoice not found" });
  });

  it("responds 403 when the customer profile is not linked", async () => {
    invoiceService.getInvoice.mockRejectedValue({
      status: 403,
      body: { message: "Customer profile is not linked" },
    });

    const response = await send("get", "/invoices/1", tokenFor("customer"));

    expect(response.status).toBe(403);
    expect(response.body).toEqual({
      message: "Customer profile is not linked",
    });
  });

  it("forwards unexpected errors to the global handler", async () => {
    invoiceService.getInvoice.mockRejectedValue(new Error("boom"));

    const response = await send("get", "/invoices/1");

    expect(response.status).toBe(500);
  });
});
