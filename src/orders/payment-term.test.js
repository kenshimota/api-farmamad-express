process.env.JWT_SECRET = "test-secret";

jest.mock("../models/user", () => ({ findByPk: jest.fn() }));
jest.mock("./service", () => ({
  orderService: { updatePaymentTerm: jest.fn() },
}));

const express = require("express");
const request = require("supertest");
const jwt = require("jsonwebtoken");
const User = require("../models/user");
const { orderService } = require("./service");
const paymentTermRouter = require("./payment-term");

const app = express();
app.use(express.json());
app.use("/orders", paymentTermRouter);
app.use((error, req, res, next) => {
  res.status(500).json({ message: "Server error" });
});

const SECRET = "test-secret";
const AUTH_USER = { id: 1, username: "admin", isBlocked: false };
const ORDER = {
  id: 10,
  number: 1,
  status: "draft",
  customer_id: 8,
  user_id: 1,
  currency_id: 3,
  payment_term_id: 3,
  subtotal: "25.00",
  total: "25.00",
  delivery_address: "Calle 1",
  notes: null,
  payment_term: { id: 3, code: "credit_15", name: "Crédito 15 días", days: 15 },
};

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
  orderService.updatePaymentTerm.mockResolvedValue(ORDER);
});

describe("PUT /orders/:id/payment-term", () => {
  it.each(["admin", "seller"])(
    "lets a %s replace the term and answers 202",
    async (role) => {
      const response = await call(
        "put",
        "/orders/10/payment-term",
        { payment_term_id: 3 },
        tokenFor(role),
      );

      expect(response.status).toBe(202);
      expect(response.body).toMatchObject({
        id: 10,
        status: "draft",
        payment_term_id: 3,
        payment_term: {
          id: 3,
          code: "credit_15",
          name: "Crédito 15 días",
          days: 15,
        },
      });
      expect(orderService.updatePaymentTerm).toHaveBeenCalledWith(
        10,
        { payment_term_id: 3 },
        expect.objectContaining({ role }),
      );
    },
  );

  it("responds 400 when payment_term_id is missing", async () => {
    const response = await call("put", "/orders/10/payment-term", {});

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      message: "payment_term_id is required",
    });
    expect(orderService.updatePaymentTerm).not.toHaveBeenCalled();
  });

  it("responds 422 for an invalid order id or term id", async () => {
    const invalidId = await call("put", "/orders/abc/payment-term", {
      payment_term_id: 3,
    });
    expect(invalidId.status).toBe(422);
    expect(invalidId.body).toEqual({ errors: { id: "Invalid order id" } });

    const invalidTerm = await call("put", "/orders/10/payment-term", {
      payment_term_id: 0,
    });
    expect(invalidTerm.status).toBe(422);
    expect(invalidTerm.body.errors).toHaveProperty("payment_term_id");
  });

  it("responds 401 and 403 for unauthorized roles", async () => {
    const anonymous = await call(
      "put",
      "/orders/10/payment-term",
      { payment_term_id: 3 },
      null,
    );
    expect(anonymous.status).toBe(401);

    const customer = await call(
      "put",
      "/orders/10/payment-term",
      { payment_term_id: 3 },
      tokenFor("customer"),
    );
    expect(customer.status).toBe(403);
  });

  it("sends the controlled errors of the service", async () => {
    orderService.updatePaymentTerm.mockRejectedValue({
      status: 422,
      body: { errors: { status: "Order is not editable" } },
    });

    const response = await call("put", "/orders/10/payment-term", {
      payment_term_id: 3,
    });

    expect(response.status).toBe(422);
    expect(response.body).toEqual({
      errors: { status: "Order is not editable" },
    });
  });
});
