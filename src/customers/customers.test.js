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
const customersRouter = require("./index");

const app = express();
app.use(express.json());
app.use("/customers", customersRouter);
app.use((error, req, res, next) => {
  res.status(500).json({ message: "Server error" });
});

const SECRET = "test-secret";
const AUTH_USER = { id: 1, username: "admin", isBlocked: false };
const validBody = {
  fullName: "Juan Pérez",
  latitude: -17.7833,
  longitude: -63.1821,
  direction: "Av. Monseñor Rivero 123",
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
 * Builds a stored customer double as returned by Sequelize.
 * @param {object} [overrides] - Attribute overrides.
 * @returns {object} The customer double.
 */
function storedCustomer(overrides = {}) {
  return {
    id: 1,
    fullName: "Juan Pérez",
    latitude: "-17.7833000",
    longitude: "-63.1821000",
    direction: "Av. Monseñor Rivero 123",
    email: "juan@example.com",
    isRegistered: false,
    createdAt: new Date("2026-09-01T00:00:00.000Z"),
    updatedAt: new Date("2026-09-01T00:00:00.000Z"),
    ...overrides,
  };
}

/**
 * Sends a POST /customers request.
 * @param {object} body - Request body.
 * @param {string|null} [token] - Bearer token, null to omit the header.
 * @returns {Promise<import("supertest").Response>} HTTP response.
 */
function post(body, token = tokenFor()) {
  const req = request(app).post("/customers");

  return token
    ? req.set("Authorization", `Bearer ${token}`).send(body)
    : req.send(body);
}

beforeEach(() => {
  Customer.create.mockReset();
  Customer.findAll.mockReset();
  Customer.findByPk.mockReset();
  User.findByPk.mockReset();
  User.findByPk.mockResolvedValue(AUTH_USER);
});

describe("POST /customers", () => {
  it.each(["admin", "seller"])(
    "allows a %s to create a customer and answers 201",
    async (role) => {
      Customer.create.mockResolvedValue(storedCustomer());

      const response = await post(validBody, tokenFor(role));

      expect(response.status).toBe(201);
      expect(response.body).toEqual({
        id: 1,
        fullName: "Juan Pérez",
        latitude: -17.7833,
        longitude: -63.1821,
        direction: "Av. Monseñor Rivero 123",
        email: "juan@example.com",
      });
      expect(response.body).not.toHaveProperty("isRegistered");
      expect(response.body).not.toHaveProperty("createdAt");
      expect(response.body).not.toHaveProperty("updatedAt");
      expect(Customer.create).toHaveBeenCalledWith(validBody);
    },
  );

  it("passes isRegistered to the model when it is provided", async () => {
    Customer.create.mockResolvedValue(storedCustomer({ isRegistered: true }));

    const response = await post({ ...validBody, isRegistered: true });

    expect(response.status).toBe(201);
    expect(Customer.create).toHaveBeenCalledWith({
      ...validBody,
      isRegistered: true,
    });
    expect(response.body).not.toHaveProperty("isRegistered");
  });

  it("responds 401 when the token is missing", async () => {
    const response = await post(validBody, null);

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ message: "Unauthorized" });
    expect(Customer.create).not.toHaveBeenCalled();
  });

  it("responds 401 when the token is invalid", async () => {
    const response = await post(validBody, "not-a-jwt");

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ message: "Unauthorized" });
    expect(Customer.create).not.toHaveBeenCalled();
  });

  it.each(["dispatcher", "manager_warehouse", "support", "customer"])(
    "responds 403 when the authenticated user is %s",
    async (role) => {
      const response = await post(validBody, tokenFor(role));

      expect(response.status).toBe(403);
      expect(response.body).toEqual({ message: "Forbidden" });
      expect(Customer.create).not.toHaveBeenCalled();
    },
  );

  it("responds 403 when the authenticated user is blocked", async () => {
    User.findByPk.mockResolvedValue({ ...AUTH_USER, isBlocked: true });

    const response = await post(validBody);

    expect(response.status).toBe(403);
    expect(response.body).toEqual({ message: "User is blocked" });
    expect(Customer.create).not.toHaveBeenCalled();
  });

  it("responds 400 listing the required fields when the body is empty", async () => {
    const response = await post({});

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      message:
        "fullName, latitude, longitude, direction and email are required",
    });
    expect(Customer.create).not.toHaveBeenCalled();
  });

  it("responds 422 with the field errors when the body is invalid", async () => {
    const response = await post({
      ...validBody,
      latitude: "norte",
      longitude: 200,
      email: "invalid@",
    });

    expect(response.status).toBe(422);
    expect(response.body).toEqual({
      errors: {
        latitude: "Latitud inválida",
        longitude: "Longitud inválida",
        email: "Email inválido",
      },
    });
    expect(Customer.create).not.toHaveBeenCalled();
  });

  it("responds 409 when the email already exists", async () => {
    Customer.create.mockRejectedValue(new UniqueConstraintError({}));

    const response = await post(validBody);

    expect(response.status).toBe(409);
    expect(response.body).toEqual({ message: "Customer already exists" });
  });

  it("forwards unexpected persistence errors", async () => {
    Customer.create.mockRejectedValue(new Error("database exploded"));

    const response = await post(validBody);

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ message: "Server error" });
  });
});

describe("router composition", () => {
  it("mounts the list router on GET /customers", async () => {
    Customer.findAll.mockResolvedValue([]);

    const response = await request(app)
      .get("/customers")
      .set("Authorization", `Bearer ${tokenFor()}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual([]);
    expect(Customer.findAll).toHaveBeenCalledWith({ order: [["id", "ASC"]] });
  });

  it("mounts the update router on PUT /customers/:id", async () => {
    const customer = storedCustomer({
      update: jest.fn(function update(values) {
        Object.assign(this, values);
        return Promise.resolve(this);
      }),
    });
    Customer.findByPk.mockResolvedValue(customer);

    const response = await request(app)
      .put("/customers/1")
      .set("Authorization", `Bearer ${tokenFor()}`)
      .send(validBody);

    expect(response.status).toBe(202);
    expect(response.body).toEqual({
      id: 1,
      fullName: validBody.fullName,
      latitude: validBody.latitude,
      longitude: validBody.longitude,
      direction: validBody.direction,
      email: validBody.email,
    });
    expect(customer.update).toHaveBeenCalledWith(validBody);
  });

  it("mounts the remove router on DELETE /customers/:id", async () => {
    const customer = storedCustomer({
      destroy: jest.fn().mockResolvedValue(),
    });
    Customer.findByPk.mockResolvedValue(customer);

    const response = await request(app)
      .delete("/customers/1")
      .set("Authorization", `Bearer ${tokenFor()}`);

    expect(response.status).toBe(204);
    expect(response.text).toBe("");
    expect(customer.destroy).toHaveBeenCalledTimes(1);
  });
});
