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
const Supplier = require("../models/supplier");
const User = require("../models/user");
const suppliersRouter = require("./index");
const { LOCATION_INCLUDE } = require("./repository");

const app = express();
app.use(express.json());
app.use("/suppliers", suppliersRouter);

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
 * Signs a JWT for the admin role.
 * @returns {string} Signed JWT.
 */
function tokenFor() {
  return jwt.sign({ sub: 1, username: "admin", role: "admin" }, SECRET, {
    expiresIn: "1h",
  });
}

beforeEach(() => {
  Supplier.create.mockReset();
  Supplier.findAll.mockReset();
  Supplier.findByPk.mockReset();
  User.findByPk.mockReset();
  User.findByPk.mockResolvedValue(AUTH_USER);
});

describe("router composition", () => {
  it("mounts the list router on GET /suppliers", async () => {
    Supplier.findAll.mockResolvedValue([]);

    const response = await request(app)
      .get("/suppliers")
      .set("Authorization", `Bearer ${tokenFor()}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual([]);
    expect(Supplier.findAll).toHaveBeenCalledWith({
      order: [["name", "ASC"]],
      include: LOCATION_INCLUDE,
    });
  });

  it("mounts the update router on PUT /suppliers/:id", async () => {
    const supplier = {
      ...STORED,
      update: jest.fn(function update(values) {
        Object.assign(this, values);
        return Promise.resolve(this);
      }),
    };
    Supplier.findByPk.mockResolvedValue(supplier);

    const response = await request(app)
      .put("/suppliers/1")
      .set("Authorization", `Bearer ${tokenFor()}`)
      .send({ name: "Nuevo nombre" });

    expect(response.status).toBe(202);
    expect(response.body.name).toBe("Nuevo nombre");
  });

  it("mounts the remove router on DELETE /suppliers/:id", async () => {
    const supplier = {
      ...STORED,
      destroy: jest.fn().mockResolvedValue(),
    };
    Supplier.findByPk.mockResolvedValue(supplier);

    const response = await request(app)
      .delete("/suppliers/1")
      .set("Authorization", `Bearer ${tokenFor()}`);

    expect(response.status).toBe(204);
    expect(response.text).toBe("");
    expect(supplier.destroy).toHaveBeenCalledTimes(1);
  });
});
