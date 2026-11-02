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
const { UniqueConstraintError } = require("sequelize");
const PaymentTerm = require("../models/payment-term");
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
const BODY = Object.freeze({
  code: "credit_30",
  name: "Crédito 30 días",
  days: 30,
});

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
 * Builds a stored term double.
 * @param {object} [overrides] - Attribute overrides.
 * @returns {object} The term double.
 */
function storedTerm(overrides = {}) {
  return {
    id: 4,
    code: "credit_30",
    name: "Crédito 30 días",
    description: null,
    days: 30,
    is_active: true,
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
});

describe("POST /payment-terms", () => {
  it.each(["admin", "seller"])(
    "allows a %s to create a term and answers 201",
    async (role) => {
      PaymentTerm.create.mockImplementation(async (values) => ({
        id: 4,
        ...values,
      }));

      const response = await call(
        "post",
        "/payment-terms",
        { ...BODY, code: "  CREDIT_30  " },
        tokenFor(role),
      );

      expect(response.status).toBe(201);
      expect(response.body).toEqual({
        id: 4,
        code: "credit_30",
        name: "Crédito 30 días",
        description: null,
        days: 30,
        is_active: true,
      });
      expect(PaymentTerm.create).toHaveBeenCalledWith({
        code: "credit_30",
        name: "Crédito 30 días",
        description: null,
        days: 30,
        is_active: true,
      });
      expect(response.body).not.toHaveProperty("createdAt");
    },
  );

  it("responds 400 when a required field is missing", async () => {
    const response = await call("post", "/payment-terms", {});

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      message: "code, name and days are required",
    });
    expect(PaymentTerm.create).not.toHaveBeenCalled();
  });

  it.each([
    [{ code: "Bad Code" }, "code"],
    [{ name: "   " }, "name"],
    [{ days: -1 }, "days"],
    [{ days: 4000 }, "days"],
    [{ days: 1.5 }, "days"],
  ])("responds 422 for the invalid body %p", async (overrides, field) => {
    const response = await call("post", "/payment-terms", {
      ...BODY,
      ...overrides,
    });

    expect(response.status).toBe(422);
    expect(response.body.errors).toHaveProperty(field);
    expect(PaymentTerm.create).not.toHaveBeenCalled();
  });

  it("responds 409 when the code already exists", async () => {
    PaymentTerm.create.mockRejectedValue(
      new UniqueConstraintError({ message: "duplicate" }),
    );

    const response = await call("post", "/payment-terms", BODY);

    expect(response.status).toBe(409);
    expect(response.body).toEqual({ message: "Payment term already exists" });
  });

  it("responds 401 and 403 for unauthorized roles", async () => {
    const anonymous = await call("post", "/payment-terms", BODY, null);
    expect(anonymous.status).toBe(401);
    expect(anonymous.body).toEqual({ message: "Unauthorized" });

    for (const role of [
      "customer",
      "dispatcher",
      "manager_warehouse",
      "support",
    ]) {
      const response = await call(
        "post",
        "/payment-terms",
        BODY,
        tokenFor(role),
      );

      expect(response.status).toBe(403);
      expect(response.body).toEqual({ message: "Forbidden" });
    }
    expect(PaymentTerm.create).not.toHaveBeenCalled();
  });

  it("forwards unexpected persistence errors", async () => {
    PaymentTerm.create.mockRejectedValue(new Error("database exploded"));

    const response = await call("post", "/payment-terms", BODY);

    expect(response.status).toBe(500);
  });
});

describe("GET /payment-terms", () => {
  it.each(["admin", "seller"])("allows a %s to list terms", async (role) => {
    PaymentTerm.findAll.mockResolvedValue([storedTerm()]);

    const response = await call(
      "get",
      "/payment-terms",
      undefined,
      tokenFor(role),
    );

    expect(response.status).toBe(200);
    expect(response.body).toEqual([
      {
        id: 4,
        code: "credit_30",
        name: "Crédito 30 días",
        description: null,
        days: 30,
        is_active: true,
      },
    ]);
    expect(PaymentTerm.findAll).toHaveBeenCalledWith({
      order: [
        ["days", "ASC"],
        ["id", "ASC"],
      ],
    });
  });

  it.each([true, false])("filters by is_active=%p", async (isActive) => {
    PaymentTerm.findAll.mockResolvedValue([]);

    const response = await call("get", `/payment-terms?is_active=${isActive}`);

    expect(response.status).toBe(200);
    expect(PaymentTerm.findAll).toHaveBeenCalledWith({
      order: [
        ["days", "ASC"],
        ["id", "ASC"],
      ],
      where: { is_active: isActive },
    });
  });

  it("responds 422 for an invalid is_active filter", async () => {
    const response = await call("get", "/payment-terms?is_active=maybe");

    expect(response.status).toBe(422);
    expect(response.body).toEqual({
      errors: { is_active: "Invalid is_active" },
    });
    expect(PaymentTerm.findAll).not.toHaveBeenCalled();
  });

  it.each(["customer", "dispatcher", "manager_warehouse", "support"])(
    "responds 403 for a %s",
    async (role) => {
      const response = await call(
        "get",
        "/payment-terms",
        undefined,
        tokenFor(role),
      );

      expect(response.status).toBe(403);
      expect(response.body).toEqual({ message: "Forbidden" });
    },
  );

  it("responds 401 without a token", async () => {
    const response = await call("get", "/payment-terms", undefined, null);

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ message: "Unauthorized" });
  });
});
