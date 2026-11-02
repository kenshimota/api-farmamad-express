process.env.JWT_SECRET = "test-secret";

jest.mock("../models/payment-term", () => ({
  create: jest.fn(),
  findAll: jest.fn(),
  findByPk: jest.fn(),
}));
jest.mock("../models/customer", () => ({ count: jest.fn() }));
jest.mock("../models/order", () => ({ count: jest.fn() }));
jest.mock("../models/invoice", () => ({ count: jest.fn() }));
jest.mock("../models/user", () => ({ findByPk: jest.fn() }));

const express = require("express");
const request = require("supertest");
const jwt = require("jsonwebtoken");
const {
  ForeignKeyConstraintError,
  UniqueConstraintError,
} = require("sequelize");
const PaymentTerm = require("../models/payment-term");
const Customer = require("../models/customer");
const Order = require("../models/order");
const Invoice = require("../models/invoice");
const User = require("../models/user");
const paymentTermsRouter = require("./index");

const app = express();
app.use(express.json());
app.use("/payment-terms", paymentTermsRouter);
app.use((error, req, res, next) => {
  res.status(500).json({ message: "Server error" });
});

const SECRET = "test-secret";
const AUTH_USER = { id: 1, username: "admin", isBlocked: false };

/**
 * Signs a JWT for the given role.
 * @param {string} [role] - Role to embed in the token.
 * @returns {string} Signed JWT.
 */
function tokenFor(role = "admin") {
  return jwt.sign({ sub: 1, username: "admin", role }, SECRET, {
    expiresIn: "1h",
  });
}

/**
 * Builds a stored term double with update and destroy.
 * @param {object} [overrides] - Attribute overrides.
 * @returns {object} The term double.
 */
function target(overrides = {}) {
  return {
    id: 4,
    code: "credit_30",
    name: "Crédito 30 días",
    description: null,
    days: 30,
    is_active: true,
    update: jest.fn(function update(values) {
      Object.assign(this, values);
      return Promise.resolve(this);
    }),
    destroy: jest.fn().mockResolvedValue(),
    ...overrides,
  };
}

/**
 * Sends an authenticated request.
 * @param {string} method - HTTP method in lowercase.
 * @param {string} path - Request path.
 * @param {object} [body] - Request body.
 * @param {string|null} [token] - Bearer token, null to omit it.
 * @returns {Promise<import("supertest").Response>} HTTP response.
 */
function call(method, path, body, token = tokenFor()) {
  const req = request(app)[method](path);

  if (body !== undefined) {
    req.send(body);
  }

  return token ? req.set("Authorization", `Bearer ${token}`) : req;
}

beforeEach(() => {
  jest.clearAllMocks();
  User.findByPk.mockResolvedValue(AUTH_USER);
  Customer.count.mockResolvedValue(0);
  Order.count.mockResolvedValue(0);
  Invoice.count.mockResolvedValue(0);
});

describe("PUT /payment-terms/:id", () => {
  it("updates the editable fields and answers 202", async () => {
    const term = target();
    PaymentTerm.findByPk.mockResolvedValue(term);

    const response = await call("put", "/payment-terms/4", {
      name: "  Crédito 45 días  ",
      description: "  Cuarenta y cinco días  ",
      days: 45,
      is_active: false,
    });

    expect(response.status).toBe(202);
    expect(term.update).toHaveBeenCalledWith({
      name: "Crédito 45 días",
      description: "Cuarenta y cinco días",
      days: 45,
      is_active: false,
    });
    expect(response.body).toEqual({
      id: 4,
      code: "credit_30",
      name: "Crédito 45 días",
      description: "Cuarenta y cinco días",
      days: 45,
      is_active: false,
    });
  });

  it("ignores code because it is immutable", async () => {
    const term = target();
    PaymentTerm.findByPk.mockResolvedValue(term);

    const response = await call("put", "/payment-terms/4", {
      code: "other_code",
      name: "Crédito 60 días",
    });

    expect(response.status).toBe(202);
    expect(term.update).toHaveBeenCalledWith({ name: "Crédito 60 días" });
    expect(response.body.code).toBe("credit_30");
  });

  it("responds 400 when no editable field is provided", async () => {
    const response = await call("put", "/payment-terms/4", {
      code: "other_code",
    });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      message: "At least one field is required",
    });
    expect(PaymentTerm.findByPk).not.toHaveBeenCalled();
  });

  it.each([
    [{ days: -1 }, "days"],
    [{ days: 1.5 }, "days"],
    [{ name: "" }, "name"],
    [{ description: "x".repeat(256) }, "description"],
  ])("responds 422 for the invalid update %p", async (body, field) => {
    const response = await call("put", "/payment-terms/4", body);

    expect(response.status).toBe(422);
    expect(response.body.errors).toHaveProperty(field);
    expect(PaymentTerm.findByPk).not.toHaveBeenCalled();
  });

  it("responds 409 when the code collides", async () => {
    const term = target();
    term.update.mockRejectedValue(new UniqueConstraintError({}));
    PaymentTerm.findByPk.mockResolvedValue(term);

    const response = await call("put", "/payment-terms/4", {
      name: "Crédito 90 días",
    });

    expect(response.status).toBe(409);
    expect(response.body).toEqual({ message: "Payment term already exists" });
  });

  it("responds 404 for an unknown term", async () => {
    PaymentTerm.findByPk.mockResolvedValue(null);

    const response = await call("put", "/payment-terms/999", { days: 10 });

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ message: "Payment term not found" });
  });

  it("responds 401 and 403 for unauthorized requests", async () => {
    const anonymous = await call("put", "/payment-terms/4", { days: 10 }, null);
    expect(anonymous.status).toBe(401);

    PaymentTerm.findByPk.mockResolvedValue(target());
    const seller = await call(
      "put",
      "/payment-terms/4",
      { days: 10 },
      tokenFor("seller"),
    );
    expect(seller.status).toBe(202);
    const customer = await call(
      "put",
      "/payment-terms/4",
      { days: 10 },
      tokenFor("customer"),
    );
    expect(customer.status).toBe(403);
  });
});

describe("DELETE /payment-terms/:id", () => {
  it("removes an unused term and answers 204", async () => {
    const term = target();
    PaymentTerm.findByPk.mockResolvedValue(term);

    const response = await call("delete", "/payment-terms/4");

    expect(response.status).toBe(204);
    expect(response.text).toBe("");
    expect(term.destroy).toHaveBeenCalledTimes(1);
  });

  it.each(["Customer", "Order", "Invoice"])(
    "responds 409 when the term is assigned to a %s",
    async (modelName) => {
      const term = target();
      PaymentTerm.findByPk.mockResolvedValue(term);
      const model = { Customer, Order, Invoice }[modelName];
      model.count.mockResolvedValue(1);

      const response = await call("delete", "/payment-terms/4");

      expect(response.status).toBe(409);
      expect(response.body).toEqual({ message: "Payment term is in use" });
      expect(term.destroy).not.toHaveBeenCalled();
    },
  );

  it("responds 409 when a foreign key blocks the delete", async () => {
    const term = target();
    term.destroy.mockRejectedValue(new ForeignKeyConstraintError({}));
    PaymentTerm.findByPk.mockResolvedValue(term);

    const response = await call("delete", "/payment-terms/4");

    expect(response.status).toBe(409);
    expect(response.body).toEqual({ message: "Payment term is in use" });
  });

  it("responds 404 for an unknown term", async () => {
    PaymentTerm.findByPk.mockResolvedValue(null);

    const response = await call("delete", "/payment-terms/999");

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ message: "Payment term not found" });
  });

  it("responds 401 and 403 for unauthorized requests", async () => {
    const anonymous = await call("delete", "/payment-terms/4", undefined, null);
    expect(anonymous.status).toBe(401);

    const support = await call(
      "delete",
      "/payment-terms/4",
      undefined,
      tokenFor("support"),
    );
    expect(support.status).toBe(403);
    expect(support.body).toEqual({ message: "Forbidden" });
  });
});
