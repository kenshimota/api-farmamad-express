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
const warehousesRouter = require("./index");

const app = express();
app.use(express.json());
app.use("/warehouses", warehousesRouter);
app.use((error, req, res, next) => {
  res.status(500).json({ message: "Server error" });
});

const SECRET = "test-secret";
const AUTH_USER = { id: 1, username: "admin", isBlocked: false };
const validBody = {
  name: "Bodega Central",
  address: "Av. Monseñor Rivero 123",
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
 * Builds a stored warehouse double as returned by Sequelize.
 * @param {object} [overrides] - Attribute overrides.
 * @returns {object} The warehouse double.
 */
function storedWarehouse(overrides = {}) {
  return {
    id: 1,
    name: "Bodega Central",
    observations: null,
    address: "Av. Monseñor Rivero 123",
    createdAt: new Date("2026-09-01T00:00:00.000Z"),
    updatedAt: new Date("2026-09-01T00:00:00.000Z"),
    ...overrides,
  };
}

/**
 * Sends a POST /warehouses request.
 * @param {object} body - Request body.
 * @param {string|null} [token] - Bearer token, null to omit the header.
 * @returns {Promise<import("supertest").Response>} HTTP response.
 */
function post(body, token = tokenFor()) {
  const req = request(app).post("/warehouses");

  return token
    ? req.set("Authorization", `Bearer ${token}`).send(body)
    : req.send(body);
}

beforeEach(() => {
  Warehouse.create.mockReset();
  Warehouse.findAll.mockReset();
  Warehouse.findByPk.mockReset();
  User.findByPk.mockReset();
  User.findByPk.mockResolvedValue(AUTH_USER);
});

describe("POST /warehouses", () => {
  it.each(["admin", "manager_warehouse"])(
    "allows a %s to create a warehouse and answers 201",
    async (role) => {
      Warehouse.create.mockResolvedValue(storedWarehouse());

      const response = await post(validBody, tokenFor(role));

      expect(response.status).toBe(201);
      expect(response.body).toEqual({
        id: 1,
        name: "Bodega Central",
        observations: null,
        address: "Av. Monseñor Rivero 123",
      });
      expect(response.body).not.toHaveProperty("createdAt");
      expect(response.body).not.toHaveProperty("updatedAt");
      expect(Warehouse.create).toHaveBeenCalledWith({
        ...validBody,
        observations: null,
      });
    },
  );

  it("stores observations when it is provided and trims it", async () => {
    Warehouse.create.mockResolvedValue(
      storedWarehouse({ observations: "Horario de 8 a 18" }),
    );

    const response = await post({
      ...validBody,
      observations: "  Horario de 8 a 18  ",
    });

    expect(response.status).toBe(201);
    expect(Warehouse.create).toHaveBeenCalledWith({
      ...validBody,
      observations: "Horario de 8 a 18",
    });
    expect(response.body.observations).toBe("Horario de 8 a 18");
  });

  it("stores null observations when null is sent", async () => {
    Warehouse.create.mockResolvedValue(storedWarehouse());

    const response = await post({ ...validBody, observations: null });

    expect(response.status).toBe(201);
    expect(Warehouse.create).toHaveBeenCalledWith({
      ...validBody,
      observations: null,
    });
  });

  it("drops unknown and audit fields", async () => {
    Warehouse.create.mockResolvedValue(storedWarehouse());

    const response = await post({
      ...validBody,
      id: 99,
      createdAt: "2026-09-01",
      updatedAt: "2026-09-01",
      admin: true,
    });

    expect(response.status).toBe(201);
    expect(Warehouse.create).toHaveBeenCalledWith({
      ...validBody,
      observations: null,
    });
  });

  it("responds 401 when the token is missing", async () => {
    const response = await post(validBody, null);

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ message: "Unauthorized" });
    expect(Warehouse.create).not.toHaveBeenCalled();
  });

  it("responds 401 when the token is invalid", async () => {
    const response = await post(validBody, "not-a-jwt");

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ message: "Unauthorized" });
    expect(Warehouse.create).not.toHaveBeenCalled();
  });

  it.each(["seller", "dispatcher", "support", "customer"])(
    "responds 403 when the authenticated user is %s",
    async (role) => {
      const response = await post(validBody, tokenFor(role));

      expect(response.status).toBe(403);
      expect(response.body).toEqual({ message: "Forbidden" });
      expect(Warehouse.create).not.toHaveBeenCalled();
    },
  );

  it("responds 403 when the authenticated user is blocked", async () => {
    User.findByPk.mockResolvedValue({ ...AUTH_USER, isBlocked: true });

    const response = await post(validBody);

    expect(response.status).toBe(403);
    expect(response.body).toEqual({ message: "User is blocked" });
    expect(Warehouse.create).not.toHaveBeenCalled();
  });

  it.each([
    [{}, "name and address are required"],
    [{ name: "Bodega Central" }, "name and address are required"],
    [{ address: "Av. Monseñor Rivero 123" }, "name and address are required"],
  ])("responds 400 when required fields are missing", async (body, message) => {
    const response = await post(body);

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ message });
    expect(Warehouse.create).not.toHaveBeenCalled();
  });

  it("responds 422 with the field errors when the body is invalid", async () => {
    const response = await post({
      ...validBody,
      name: "   ",
      address: { a: 1 },
      observations: { a: 1 },
    });

    expect(response.status).toBe(422);
    expect(response.body).toEqual({
      errors: {
        name: "Nombre inválido",
        address: "Dirección inválida",
        observations: "Observaciones inválidas",
      },
    });
    expect(Warehouse.create).not.toHaveBeenCalled();
  });

  it("forwards unexpected persistence errors", async () => {
    Warehouse.create.mockRejectedValue(new Error("database exploded"));

    const response = await post(validBody);

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ message: "Server error" });
  });
});

describe("router composition", () => {
  it("mounts the list router on GET /warehouses", async () => {
    Warehouse.findAll.mockResolvedValue([]);

    const response = await request(app)
      .get("/warehouses")
      .set("Authorization", `Bearer ${tokenFor()}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual([]);
    expect(Warehouse.findAll).toHaveBeenCalledWith({
      order: [["id", "ASC"]],
    });
  });

  it("mounts the update router on PUT /warehouses/:id", async () => {
    const warehouse = storedWarehouse({
      update: jest.fn(function update(values) {
        Object.assign(this, values);
        return Promise.resolve(this);
      }),
    });
    Warehouse.findByPk.mockResolvedValue(warehouse);

    const response = await request(app)
      .put("/warehouses/1")
      .set("Authorization", `Bearer ${tokenFor()}`)
      .send(validBody);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      id: 1,
      name: validBody.name,
      observations: null,
      address: validBody.address,
    });
    expect(warehouse.update).toHaveBeenCalledWith(validBody);
  });

  it("mounts the remove router on DELETE /warehouses/:id", async () => {
    const warehouse = storedWarehouse({
      destroy: jest.fn().mockResolvedValue(),
    });
    Warehouse.findByPk.mockResolvedValue(warehouse);

    const response = await request(app)
      .delete("/warehouses/1")
      .set("Authorization", `Bearer ${tokenFor()}`);

    expect(response.status).toBe(204);
    expect(response.text).toBe("");
    expect(warehouse.destroy).toHaveBeenCalledTimes(1);
  });
});
