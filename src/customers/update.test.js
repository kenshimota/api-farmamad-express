process.env.JWT_SECRET = "test-secret";

jest.mock("../models/customer", () => ({
  create: jest.fn(),
  findAll: jest.fn(),
  findByPk: jest.fn(),
}));
jest.mock("../models/user", () => ({ findByPk: jest.fn() }));

const express = require("express");
const request = require("supertest");
const jwt = require("jsonwebtoken");
const { UniqueConstraintError } = require("sequelize");
const Customer = require("../models/customer");
const User = require("../models/user");
const updateRouter = require("./update");

const app = express();
app.use(express.json());
app.use("/customers", updateRouter);
app.use((error, req, res, next) => {
  res.status(500).json({ message: "Server error" });
});

const SECRET = "test-secret";
const AUTH_USER = { id: 1, username: "admin", isBlocked: false };
const validBody = {
  fullName: "Juan Pérez Gómez",
  latitude: -17.79,
  longitude: -63.19,
  direction: "Av. Monseñor Rivero 456",
  email: "juan@example.com",
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
 * Builds a stored customer double with a working update method.
 * @param {object} [overrides] - Attribute overrides.
 * @returns {object} The customer double.
 */
function target(overrides = {}) {
  return {
    id: 1,
    fullName: "Juan Pérez",
    latitude: "-17.7833000",
    longitude: "-63.1821000",
    direction: "Av. Monseñor Rivero 123",
    email: "juan@example.com",
    isRegistered: false,
    update: jest.fn(function update(values) {
      Object.assign(this, values);
      return Promise.resolve(this);
    }),
    ...overrides,
  };
}

/**
 * Sends a PUT /customers/:id request.
 * @param {string} id - Route parameter.
 * @param {object} body - Request body.
 * @param {string|null} [token] - Bearer token, null to omit the header.
 * @returns {Promise<import("supertest").Response>} HTTP response.
 */
function put(id, body, token = tokenFor()) {
  const req = request(app).put(`/customers/${id}`);

  return token
    ? req.set("Authorization", `Bearer ${token}`).send(body)
    : req.send(body);
}

beforeEach(() => {
  Customer.findByPk.mockReset();
  User.findByPk.mockReset();
  User.findByPk.mockResolvedValue(AUTH_USER);
});

describe("PUT /customers/:id", () => {
  it.each(["admin", "seller"])(
    "allows a %s to update every field and answers 200",
    async (role) => {
      const customer = target();
      Customer.findByPk.mockResolvedValue(customer);

      const response = await put("1", validBody, tokenFor(role));

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        id: 1,
        fullName: "Juan Pérez Gómez",
        latitude: -17.79,
        longitude: -63.19,
        direction: "Av. Monseñor Rivero 456",
        email: "juan@example.com",
      });
      expect(customer.update).toHaveBeenCalledWith(validBody);
      expect(response.body).not.toHaveProperty("isRegistered");
      expect(response.body).not.toHaveProperty("createdAt");
    },
  );

  it("keeps isRegistered untouched when it is not sent", async () => {
    const customer = target({ isRegistered: true });
    Customer.findByPk.mockResolvedValue(customer);

    const response = await put("1", validBody);

    expect(response.status).toBe(200);
    expect(customer.update).toHaveBeenCalledWith(validBody);
  });

  it("responds 404 when the customer does not exist", async () => {
    Customer.findByPk.mockResolvedValue(null);

    const response = await put("999", validBody);

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ message: "Customer not found" });
  });

  it("responds 409 when the email belongs to another customer", async () => {
    const customer = target();
    customer.update.mockRejectedValue(new UniqueConstraintError({}));
    Customer.findByPk.mockResolvedValue(customer);

    const response = await put("1", { ...validBody, email: "ana@example.com" });

    expect(response.status).toBe(409);
    expect(response.body).toEqual({ message: "Customer already exists" });
  });

  it.each(["abc", "0", "-1", "1.5"])(
    "responds 422 when the id is %s",
    async (id) => {
      const response = await put(id, validBody);

      expect(response.status).toBe(422);
      expect(response.body).toEqual({
        errors: { id: "Invalid customer id" },
      });
      expect(Customer.findByPk).not.toHaveBeenCalled();
    },
  );

  it("responds 400 when required fields are missing", async () => {
    const response = await put("1", { fullName: "Juan Pérez" });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      message:
        "fullName, latitude, longitude, direction and email are required",
    });
    expect(Customer.findByPk).not.toHaveBeenCalled();
  });

  it("responds 422 when a field is invalid", async () => {
    const response = await put("1", { ...validBody, latitude: 100 });

    expect(response.status).toBe(422);
    expect(response.body).toEqual({
      errors: { latitude: "Latitud inválida" },
    });
    expect(Customer.findByPk).not.toHaveBeenCalled();
  });

  it("responds 401 when the token is missing", async () => {
    const response = await put("1", validBody, null);

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ message: "Unauthorized" });
    expect(Customer.findByPk).not.toHaveBeenCalled();
  });

  it.each(["delivery", "freelance_delivery", "customer"])(
    "responds 403 when the authenticated user is %s",
    async (role) => {
      const response = await put("1", validBody, tokenFor(role));

      expect(response.status).toBe(403);
      expect(response.body).toEqual({ message: "Forbidden" });
      expect(Customer.findByPk).not.toHaveBeenCalled();
    },
  );

  it("responds 403 when the authenticated user is blocked", async () => {
    User.findByPk.mockResolvedValue({ ...AUTH_USER, isBlocked: true });

    const response = await put("1", validBody);

    expect(response.status).toBe(403);
    expect(response.body).toEqual({ message: "User is blocked" });
  });

  it("forwards unexpected persistence errors", async () => {
    const customer = target();
    customer.update.mockRejectedValue(new Error("database exploded"));
    Customer.findByPk.mockResolvedValue(customer);

    const response = await put("1", validBody);

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ message: "Server error" });
  });
});
