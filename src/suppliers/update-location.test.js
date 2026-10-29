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
const City = require("../models/city");
const State = require("../models/state");
const User = require("../models/user");
const updateRouter = require("./update");

const app = express();
app.use(express.json());
app.use("/suppliers", updateRouter);

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
 * @returns {Promise<import("supertest").Response>} HTTP response.
 */
function put(id, body) {
  return request(app)
    .put(`/suppliers/${id}`)
    .set("Authorization", `Bearer ${tokenFor()}`)
    .send(body);
}

beforeEach(() => {
  Supplier.findByPk.mockReset();
  City.findByPk.mockReset();
  State.findByPk.mockReset();
  User.findByPk.mockReset();
  User.findByPk.mockResolvedValue(AUTH_USER);
});

describe("PUT /suppliers/:id location rules", () => {
  it("derives the state when only city_id changes", async () => {
    const supplier = target();
    Supplier.findByPk.mockResolvedValue(supplier);
    City.findByPk.mockResolvedValue({ id: 11, name: "Valencia", state_id: 5 });

    const response = await put("1", { city_id: 11 });

    expect(response.status).toBe(202);
    expect(City.findByPk).toHaveBeenCalledWith(11);
    expect(State.findByPk).not.toHaveBeenCalled();
    expect(supplier.update).toHaveBeenCalledWith({
      city_id: 11,
      state_id: 5,
    });
  });

  it("accepts a coherent city and state pair", async () => {
    const supplier = target();
    Supplier.findByPk.mockResolvedValue(supplier);
    City.findByPk.mockResolvedValue({ id: 11, name: "Valencia", state_id: 5 });
    State.findByPk.mockResolvedValue({ id: 5, name: "Carabobo", code: "VE-G" });

    const response = await put("1", { city_id: 11, state_id: 5 });

    expect(response.status).toBe(202);
    expect(supplier.update).toHaveBeenCalledWith({
      city_id: 11,
      state_id: 5,
    });
  });

  it("rejects a city that does not belong to the state", async () => {
    const supplier = target();
    Supplier.findByPk.mockResolvedValue(supplier);
    City.findByPk.mockResolvedValue({ id: 11, name: "Valencia", state_id: 5 });
    State.findByPk.mockResolvedValue({ id: 4, name: "Aragua", code: "VE-D" });

    const response = await put("1", { city_id: 11, state_id: 4 });

    expect(response.status).toBe(422);
    expect(response.body).toEqual({
      errors: { city_id: "City does not belong to state" },
    });
    expect(supplier.update).not.toHaveBeenCalled();
  });

  it("validates a state change against the current city", async () => {
    const supplier = target({ city_id: 10, state_id: 4 });
    Supplier.findByPk.mockResolvedValue(supplier);
    City.findByPk.mockResolvedValue({ id: 10, name: "Maracay", state_id: 5 });
    State.findByPk.mockResolvedValue({ id: 5, name: "Carabobo", code: "VE-G" });

    const response = await put("1", { state_id: 5 });

    expect(response.status).toBe(202);
    expect(supplier.update).toHaveBeenCalledWith({ state_id: 5 });
  });

  it("rejects an incoherent state change against the current city", async () => {
    const supplier = target({ city_id: 10, state_id: 4 });
    Supplier.findByPk.mockResolvedValue(supplier);
    City.findByPk.mockResolvedValue({ id: 10, name: "Maracay", state_id: 4 });
    State.findByPk.mockResolvedValue({ id: 5, name: "Carabobo", code: "VE-G" });

    const response = await put("1", { state_id: 5 });

    expect(response.status).toBe(422);
    expect(response.body).toEqual({
      errors: { city_id: "City does not belong to state" },
    });
    expect(supplier.update).not.toHaveBeenCalled();
  });

  it("responds 422 when the new city or state does not exist", async () => {
    const supplier = target();
    Supplier.findByPk.mockResolvedValue(supplier);
    City.findByPk.mockResolvedValue(null);

    const city = await put("1", { city_id: 999 });
    expect(city.status).toBe(422);
    expect(city.body).toEqual({ errors: { city_id: "Invalid city id" } });

    State.findByPk.mockResolvedValue(null);
    const state = await put("1", { state_id: 999 });
    expect(state.status).toBe(422);
    expect(state.body).toEqual({ errors: { state_id: "Invalid state" } });

    expect(supplier.update).not.toHaveBeenCalled();
  });
});
