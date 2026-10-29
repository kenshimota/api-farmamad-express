process.env.JWT_SECRET = "test-secret";

jest.mock("../models/warehouse", () => ({
  create: jest.fn(),
  findAll: jest.fn(),
  findByPk: jest.fn(),
}));
jest.mock("../models/user", () => ({ findByPk: jest.fn() }));

const express = require("express");
const request = require("supertest");
const jwt = require("jsonwebtoken");
const Warehouse = require("../models/warehouse");
const User = require("../models/user");
const updateRouter = require("./update");

const app = express();
app.use(express.json());
app.use("/warehouses", updateRouter);
app.use((error, req, res, next) => {
  res.status(500).json({ message: "Server error" });
});

const SECRET = "test-secret";
const AUTH_USER = { id: 1, username: "admin", isBlocked: false };
const validBody = {
  name: "Bodega Sur",
  address: "Calle 3 #10",
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
 * Builds a stored warehouse double with a working update method.
 * @param {object} [overrides] - Attribute overrides.
 * @returns {object} The warehouse double.
 */
function target(overrides = {}) {
  return {
    id: 1,
    name: "Bodega Central",
    observations: "Horario de 8 a 18",
    address: "Av. Monseñor Rivero 123",
    update: jest.fn(function update(values) {
      Object.assign(this, values);
      return Promise.resolve(this);
    }),
    ...overrides,
  };
}

/**
 * Sends a PUT /warehouses/:id request.
 * @param {string} id - Route parameter.
 * @param {object} body - Request body.
 * @param {string|null} [token] - Bearer token, null to omit the header.
 * @returns {Promise<import("supertest").Response>} HTTP response.
 */
function put(id, body, token = tokenFor()) {
  const req = request(app).put(`/warehouses/${id}`);

  return token
    ? req.set("Authorization", `Bearer ${token}`).send(body)
    : req.send(body);
}

beforeEach(() => {
  Warehouse.findByPk.mockReset();
  User.findByPk.mockReset();
  User.findByPk.mockResolvedValue(AUTH_USER);
});

describe("PUT /warehouses/:id", () => {
  it.each(["admin", "manager_warehouse"])(
    "allows a %s to update name and address and answers 200",
    async (role) => {
      const warehouse = target();
      Warehouse.findByPk.mockResolvedValue(warehouse);

      const response = await put("1", validBody, tokenFor(role));

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        id: 1,
        name: "Bodega Sur",
        observations: "Horario de 8 a 18",
        address: "Calle 3 #10",
      });
      expect(warehouse.update).toHaveBeenCalledWith(validBody);
      expect(response.body).not.toHaveProperty("createdAt");
      expect(response.body).not.toHaveProperty("updatedAt");
    },
  );

  it("keeps observations untouched when it is not sent", async () => {
    const warehouse = target({ observations: null });
    Warehouse.findByPk.mockResolvedValue(warehouse);

    const response = await put("1", validBody);

    expect(response.status).toBe(200);
    expect(warehouse.update).toHaveBeenCalledWith(validBody);
    expect(warehouse.update.mock.calls[0][0]).not.toHaveProperty(
      "observations",
    );
  });

  it("updates observations when it is sent, including null", async () => {
    const warehouse = target();
    Warehouse.findByPk.mockResolvedValue(warehouse);

    const response = await put("1", {
      ...validBody,
      observations: null,
    });

    expect(response.status).toBe(200);
    expect(warehouse.update).toHaveBeenCalledWith({
      ...validBody,
      observations: null,
    });
    expect(response.body.observations).toBeNull();
  });

  it("drops unknown and audit fields", async () => {
    const warehouse = target();
    Warehouse.findByPk.mockResolvedValue(warehouse);

    const response = await put("1", {
      ...validBody,
      id: 99,
      createdAt: "2026-09-01",
      updatedAt: "2026-09-01",
      admin: true,
    });

    expect(response.status).toBe(200);
    expect(warehouse.update).toHaveBeenCalledWith(validBody);
  });

  it("responds 404 when the warehouse does not exist", async () => {
    Warehouse.findByPk.mockResolvedValue(null);

    const response = await put("999", validBody);

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ message: "Warehouse not found" });
  });

  it.each(["abc", "0", "-1", "1.5"])(
    "responds 422 when the id is %s",
    async (id) => {
      const response = await put(id, validBody);

      expect(response.status).toBe(422);
      expect(response.body).toEqual({
        errors: { id: "Invalid warehouse id" },
      });
      expect(Warehouse.findByPk).not.toHaveBeenCalled();
    },
  );

  it.each([
    [{}, "name and address are required"],
    [{ name: "Bodega Sur" }, "name and address are required"],
    [{ address: "Calle 3 #10" }, "name and address are required"],
  ])("responds 400 when required fields are missing", async (body, message) => {
    const response = await put("1", body);

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ message });
    expect(Warehouse.findByPk).not.toHaveBeenCalled();
  });

  it("responds 422 when a field is invalid", async () => {
    const response = await put("1", { ...validBody, name: "   " });

    expect(response.status).toBe(422);
    expect(response.body).toEqual({
      errors: { name: "Nombre inválido" },
    });
    expect(Warehouse.findByPk).not.toHaveBeenCalled();
  });

  it("responds 401 when the token is missing", async () => {
    const response = await put("1", validBody, null);

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ message: "Unauthorized" });
    expect(Warehouse.findByPk).not.toHaveBeenCalled();
  });

  it.each(["seller", "dispatcher", "support", "customer"])(
    "responds 403 when the authenticated user is %s",
    async (role) => {
      const response = await put("1", validBody, tokenFor(role));

      expect(response.status).toBe(403);
      expect(response.body).toEqual({ message: "Forbidden" });
      expect(Warehouse.findByPk).not.toHaveBeenCalled();
    },
  );

  it("responds 403 when the authenticated user is blocked", async () => {
    User.findByPk.mockResolvedValue({ ...AUTH_USER, isBlocked: true });

    const response = await put("1", validBody);

    expect(response.status).toBe(403);
    expect(response.body).toEqual({ message: "User is blocked" });
  });

  it("forwards unexpected persistence errors", async () => {
    const warehouse = target();
    warehouse.update.mockRejectedValue(new Error("database exploded"));
    Warehouse.findByPk.mockResolvedValue(warehouse);

    const response = await put("1", validBody);

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ message: "Server error" });
  });
});
