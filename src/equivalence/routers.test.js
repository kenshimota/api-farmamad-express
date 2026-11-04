process.env.JWT_SECRET = "test-secret";

jest.mock("../models/user", () => ({ findByPk: jest.fn() }));
jest.mock("./service", () => ({
  equivalenceService: {
    getOrderEquivalence: jest.fn(),
    getInvoiceEquivalence: jest.fn(),
  },
}));

const express = require("express");
const request = require("supertest");
const jwt = require("jsonwebtoken");
const User = require("../models/user");
const { equivalenceService } = require("./service");
const ordersRouter = require("./orders-router");
const invoicesRouter = require("./invoices-router");

const app = express();
app.use(express.json());
app.use("/orders", ordersRouter);
app.use("/invoices", invoicesRouter);
app.use((error, req, res, next) => {
  res.status(500).json({ message: "Internal server error" });
});

const SECRET = "test-secret";

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
  User.findByPk.mockResolvedValue({ id: 1, isBlocked: false });
  equivalenceService.getOrderEquivalence.mockResolvedValue({
    resource: "order",
  });
  equivalenceService.getInvoiceEquivalence.mockResolvedValue({
    resource: "invoice",
  });
});

describe("GET /orders/:id/equivalence", () => {
  it("responds 401 without a token", async () => {
    const response = await send("get", "/orders/10/equivalence", null);

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ message: "Unauthorized" });
  });

  it.each(["dispatcher", "manager_warehouse", "support"])(
    "responds 403 for a %s",
    async (role) => {
      const response = await send(
        "get",
        "/orders/10/equivalence",
        tokenFor(role),
      );

      expect(response.status).toBe(403);
      expect(response.body).toEqual({ message: "Forbidden" });
      expect(equivalenceService.getOrderEquivalence).not.toHaveBeenCalled();
    },
  );

  it("responds 422 for an invalid order id without calling the service", async () => {
    const response = await send("get", "/orders/abc/equivalence");

    expect(response.status).toBe(422);
    expect(response.body).toEqual({ errors: { id: "Invalid order id" } });
    expect(equivalenceService.getOrderEquivalence).not.toHaveBeenCalled();
  });

  it.each(["abc", "0", "-1", "1.5", ""])(
    "responds 422 for the invalid currency_id %p",
    async (value) => {
      const response = await send(
        "get",
        `/orders/10/equivalence?currency_id=${value}`,
      );

      expect(response.status).toBe(422);
      expect(response.body).toEqual({
        errors: { currency_id: "Invalid currency_id" },
      });
      expect(equivalenceService.getOrderEquivalence).not.toHaveBeenCalled();
    },
  );

  it("defaults the target currency when currency_id is omitted", async () => {
    const response = await send("get", "/orders/10/equivalence");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ resource: "order" });
    expect(equivalenceService.getOrderEquivalence).toHaveBeenCalledWith(
      10,
      expect.objectContaining({ role: "admin" }),
      undefined,
    );
  });

  it("forwards the requested currency and the actor", async () => {
    const response = await send(
      "get",
      "/orders/10/equivalence?currency_id=2",
      tokenFor("customer"),
    );

    expect(response.status).toBe(200);
    expect(equivalenceService.getOrderEquivalence).toHaveBeenCalledWith(
      10,
      expect.objectContaining({ role: "customer" }),
      2,
    );
  });

  it("forwards controlled errors", async () => {
    equivalenceService.getOrderEquivalence.mockRejectedValue({
      status: 404,
      body: { message: "Order not found" },
    });

    const response = await send("get", "/orders/10/equivalence");

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ message: "Order not found" });
  });

  it("forwards unexpected errors to the global handler", async () => {
    equivalenceService.getOrderEquivalence.mockRejectedValue(new Error("boom"));

    const response = await send("get", "/orders/10/equivalence");

    expect(response.status).toBe(500);
  });
});

describe("GET /invoices/:id/equivalence", () => {
  it("responds 401 without a token", async () => {
    const response = await send("get", "/invoices/7/equivalence", null);

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ message: "Unauthorized" });
  });

  it.each(["dispatcher", "manager_warehouse", "support"])(
    "responds 403 for a %s",
    async (role) => {
      const response = await send(
        "get",
        "/invoices/7/equivalence",
        tokenFor(role),
      );

      expect(response.status).toBe(403);
      expect(response.body).toEqual({ message: "Forbidden" });
      expect(equivalenceService.getInvoiceEquivalence).not.toHaveBeenCalled();
    },
  );

  it("responds 422 for an invalid invoice id", async () => {
    const response = await send("get", "/invoices/0/equivalence");

    expect(response.status).toBe(422);
    expect(response.body).toEqual({ errors: { id: "Invalid invoice id" } });
  });

  it("responds 422 for an invalid currency_id", async () => {
    const response = await send(
      "get",
      "/invoices/7/equivalence?currency_id=nope",
    );

    expect(response.status).toBe(422);
    expect(response.body).toEqual({
      errors: { currency_id: "Invalid currency_id" },
    });
  });

  it("returns the invoice equivalence and forwards the currency", async () => {
    const response = await send("get", "/invoices/7/equivalence?currency_id=1");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ resource: "invoice" });
    expect(equivalenceService.getInvoiceEquivalence).toHaveBeenCalledWith(
      7,
      expect.objectContaining({ role: "admin" }),
      1,
    );
  });

  it("forwards controlled errors", async () => {
    equivalenceService.getInvoiceEquivalence.mockRejectedValue({
      status: 404,
      body: { message: "Invoice not found" },
    });

    const response = await send("get", "/invoices/7/equivalence");

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ message: "Invoice not found" });
  });
});
