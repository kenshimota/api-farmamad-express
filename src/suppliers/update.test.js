process.env.JWT_SECRET = "test-secret";

jest.mock("../models/supplier", () => ({
  create: jest.fn(),
  findAll: jest.fn(),
  findByPk: jest.fn(),
}));
jest.mock("../models/city", () => ({ findByPk: jest.fn() }));
jest.mock("../models/state", () => ({ findByPk: jest.fn() }));
jest.mock("../models/user", () => ({ findByPk: jest.fn() }));

const express = require("express");
const request = require("supertest");
const jwt = require("jsonwebtoken");
const { UniqueConstraintError } = require("sequelize");
const Supplier = require("../models/supplier");
const User = require("../models/user");
const updateRouter = require("./update");

const app = express();
app.use(express.json());
app.use("/suppliers", updateRouter);
app.use((error, req, res, next) => {
  res.status(500).json({ message: "Server error" });
});

const SECRET = "test-secret";
const AUTH_USER = { id: 1, username: "admin", isBlocked: false };
const STORED = {
  id: 1,
  name: "Distribuidora La Salud C.A.",
  identification: "J-12345678-9",
  email: "ventas@lasalud.com",
  phone: "+58 212 555-1234",
  observations: "Entrega los martes",
  address: "Av. Principal, Galpón 4",
  city_id: 10,
  state_id: 4,
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
 * Builds a stored supplier double with a working update method.
 * @param {object} [overrides] - Attribute overrides.
 * @returns {object} The supplier double.
 */
function target(overrides = {}) {
  return {
    ...STORED,
    update: jest.fn(function update(values) {
      Object.assign(this, values);
      return Promise.resolve(this);
    }),
    ...overrides,
  };
}

/**
 * Sends a PUT /suppliers/:id request.
 * @param {string} id - Route parameter.
 * @param {object} body - Request body.
 * @param {string|null} [token] - Bearer token, null to omit the header.
 * @returns {Promise<import("supertest").Response>} HTTP response.
 */
function put(id, body, token = tokenFor()) {
  const req = request(app).put(`/suppliers/${id}`);

  return token
    ? req.set("Authorization", `Bearer ${token}`).send(body)
    : req.send(body);
}

beforeEach(() => {
  Supplier.findByPk.mockReset();
  User.findByPk.mockReset();
  User.findByPk.mockResolvedValue(AUTH_USER);
});

describe("PUT /suppliers/:id", () => {
  it.each(["admin", "seller"])(
    "allows a %s to update a field and answers 202",
    async (role) => {
      const supplier = target();
      Supplier.findByPk.mockResolvedValue(supplier);

      const response = await put(
        "1",
        { name: "  Distribuidora Central  " },
        tokenFor(role),
      );

      expect(response.status).toBe(202);
      expect(response.body.name).toBe("Distribuidora Central");
      expect(supplier.update).toHaveBeenCalledWith({
        name: "Distribuidora Central",
      });
      expect(response.body).not.toHaveProperty("createdAt");
      expect(response.body).not.toHaveProperty("updatedAt");
    },
  );

  it("normalizes identification and email on update", async () => {
    const supplier = target();
    Supplier.findByPk.mockResolvedValue(supplier);

    const response = await put("1", {
      identification: " j-87654321-0 ",
      email: " VENTAS@OTRO.COM ",
    });

    expect(response.status).toBe(202);
    expect(supplier.update).toHaveBeenCalledWith({
      identification: "J-87654321-0",
      email: "ventas@otro.com",
    });
  });

  it("updates observations alone", async () => {
    const supplier = target();
    Supplier.findByPk.mockResolvedValue(supplier);

    const response = await put("1", { observations: "  Nuevo horario  " });

    expect(response.status).toBe(202);
    expect(supplier.update).toHaveBeenCalledWith({
      observations: "Nuevo horario",
    });
  });

  it("responds 409 when the identification belongs to another supplier", async () => {
    const supplier = target();
    supplier.update.mockRejectedValue(
      new UniqueConstraintError({ message: "duplicate" }),
    );
    Supplier.findByPk.mockResolvedValue(supplier);

    const response = await put("1", { identification: "J-00000000-0" });

    expect(response.status).toBe(409);
    expect(response.body).toEqual({ message: "Supplier already exists" });
  });

  it("responds 404 when the supplier does not exist", async () => {
    Supplier.findByPk.mockResolvedValue(null);

    const response = await put("999", { name: "Nuevo nombre" });

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ message: "Supplier not found" });
  });

  it.each(["abc", "0", "-1", "1.5"])(
    "responds 422 when the id is %s",
    async (id) => {
      const response = await put(id, { name: "Nuevo nombre" });

      expect(response.status).toBe(422);
      expect(response.body).toEqual({
        errors: { id: "Invalid supplier id" },
      });
      expect(Supplier.findByPk).not.toHaveBeenCalled();
    },
  );

  it("responds 400 when no field is provided", async () => {
    const response = await put("1", {});

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      message: "At least one field is required",
    });
    expect(Supplier.findByPk).not.toHaveBeenCalled();
  });

  it.each([
    [{ name: "A" }, { name: "Nombre inválido" }],
    [{ identification: "A-1" }, { identification: "Identificación inválida" }],
    [{ email: "not-an-email" }, { email: "Email inválido" }],
    [{ phone: "123" }, { phone: "Teléfono inválido" }],
    [{ address: "Av 1" }, { address: "Dirección inválida" }],
    [
      { observations: "o".repeat(1001) },
      { observations: "Observaciones inválidas" },
    ],
    [{ city_id: 0 }, { city_id: "Invalid city id" }],
    [{ state_id: null }, { state_id: "Invalid state" }],
  ])(
    "responds 422 when a provided field is invalid in %p",
    async (body, errors) => {
      const response = await put("1", body);

      expect(response.status).toBe(422);
      expect(response.body).toEqual({ errors });
      expect(Supplier.findByPk).not.toHaveBeenCalled();
    },
  );

  it("responds 401 when the token is missing", async () => {
    const response = await put("1", { name: "Nuevo nombre" }, null);

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ message: "Unauthorized" });
    expect(Supplier.findByPk).not.toHaveBeenCalled();
  });

  it.each(["dispatcher", "manager_warehouse", "support", "customer"])(
    "responds 403 when the authenticated user is %s",
    async (role) => {
      const response = await put("1", { name: "Nuevo nombre" }, tokenFor(role));

      expect(response.status).toBe(403);
      expect(response.body).toEqual({ message: "Forbidden" });
      expect(Supplier.findByPk).not.toHaveBeenCalled();
    },
  );

  it("responds 403 when the authenticated user is blocked", async () => {
    User.findByPk.mockResolvedValue({ ...AUTH_USER, isBlocked: true });

    const response = await put("1", { name: "Nuevo nombre" });

    expect(response.status).toBe(403);
    expect(response.body).toEqual({ message: "User is blocked" });
  });

  it("forwards unexpected persistence errors", async () => {
    const supplier = target();
    supplier.update.mockRejectedValue(new Error("database exploded"));
    Supplier.findByPk.mockResolvedValue(supplier);

    const response = await put("1", { name: "Nuevo nombre" });

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ message: "Server error" });
  });
});
