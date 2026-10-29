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
const City = require("../models/city");
const State = require("../models/state");
const User = require("../models/user");
const suppliersRouter = require("./index");
const { LOCATION_INCLUDE } = require("./repository");

const app = express();
app.use(express.json());
app.use("/suppliers", suppliersRouter);
app.use((error, req, res, next) => {
  res.status(500).json({ message: "Server error" });
});

const SECRET = "test-secret";
const AUTH_USER = { id: 1, username: "admin", isBlocked: false };
const CITY = { id: 10, name: "Maracay", state_id: 4 };
const STATE = { id: 4, name: "Aragua", code: "VE-D" };
const VALID = {
  name: "Distribuidora La Salud C.A.",
  identification: "J-12345678-9",
  email: "ventas@lasalud.com",
  phone: "+58 212 555-1234",
  observations: "Entrega los martes",
  address: "Av. Principal, Galpón 4",
  city_id: 10,
  state_id: 4,
};
const REQUIRED_MESSAGE =
  "name, identification, email, phone, address, city_id and state_id are required";

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
 * Sends a POST /suppliers request.
 * @param {object} body - Request body.
 * @param {string|null} [token] - Bearer token, null to omit the header.
 * @param {string} [path] - Request path.
 * @returns {Promise<import("supertest").Response>} HTTP response.
 */
function post(body, token = tokenFor(), path = "/suppliers") {
  const req = request(app).post(path);

  return token
    ? req.set("Authorization", `Bearer ${token}`).send(body)
    : req.send(body);
}

beforeEach(() => {
  Supplier.create.mockReset();
  Supplier.findAll.mockReset();
  Supplier.findByPk.mockReset();
  City.findByPk.mockReset();
  City.findByPk.mockResolvedValue(CITY);
  State.findByPk.mockReset();
  State.findByPk.mockResolvedValue(STATE);
  User.findByPk.mockReset();
  User.findByPk.mockResolvedValue(AUTH_USER);
});

describe("POST /suppliers", () => {
  it.each(["admin", "seller"])(
    "allows a %s to create a supplier and answers 201",
    async (role) => {
      Supplier.create.mockImplementation(async (values) => ({
        id: 1,
        ...values,
      }));

      const response = await post(VALID, tokenFor(role));

      expect(response.status).toBe(201);
      expect(response.body).toEqual({ id: 1, ...VALID });
      expect(Supplier.create).toHaveBeenCalledWith(VALID);
      expect(City.findByPk).toHaveBeenCalledWith(10);
      expect(State.findByPk).toHaveBeenCalledWith(4);
      expect(response.body).not.toHaveProperty("createdAt");
      expect(response.body).not.toHaveProperty("updatedAt");
    },
  );

  it("normalizes identification, email and text fields before persisting", async () => {
    Supplier.create.mockImplementation(async (values) => ({
      id: 1,
      ...values,
    }));

    const response = await post({
      ...VALID,
      name: "  Distribuidora La Salud C.A.  ",
      identification: " j-12345678-9 ",
      email: " VENTAS@LaSalud.com ",
      phone: " +58 212 555-1234 ",
      observations: "  Entrega los martes  ",
      address: "  Av. Principal, Galpón 4  ",
    });

    expect(response.status).toBe(201);
    expect(Supplier.create).toHaveBeenCalledWith(VALID);
    expect(response.body.identification).toBe("J-12345678-9");
    expect(response.body.email).toBe("ventas@lasalud.com");
  });

  it("nests city and state when include=location is requested", async () => {
    Supplier.create.mockImplementation(async (values) => ({
      id: 1,
      ...values,
    }));
    Supplier.findByPk.mockResolvedValue({
      id: 1,
      ...VALID,
      city: CITY,
      state: STATE,
    });

    const response = await post(
      VALID,
      tokenFor(),
      "/suppliers?include=location",
    );

    expect(response.status).toBe(201);
    expect(Supplier.findByPk).toHaveBeenCalledWith(1, {
      include: LOCATION_INCLUDE,
    });
    expect(response.body).toEqual({
      id: 1,
      ...VALID,
      city: { id: 10, name: "Maracay" },
      state: STATE,
    });
  });

  it("drops unknown and audit fields", async () => {
    Supplier.create.mockImplementation(async (values) => ({
      id: 1,
      ...values,
    }));

    const response = await post({
      ...VALID,
      id: 99,
      createdAt: "2026-09-01",
      updatedAt: "2026-09-01",
      admin: true,
    });

    expect(response.status).toBe(201);
    expect(Supplier.create).toHaveBeenCalledWith(VALID);
  });

  it("responds 422 when the city does not exist", async () => {
    City.findByPk.mockResolvedValue(null);

    const response = await post(VALID);

    expect(response.status).toBe(422);
    expect(response.body).toEqual({ errors: { city_id: "Invalid city id" } });
    expect(Supplier.create).not.toHaveBeenCalled();
  });

  it("responds 422 when the state does not exist", async () => {
    State.findByPk.mockResolvedValue(null);

    const response = await post(VALID);

    expect(response.status).toBe(422);
    expect(response.body).toEqual({ errors: { state_id: "Invalid state" } });
    expect(Supplier.create).not.toHaveBeenCalled();
  });

  it("responds 422 when the city does not belong to the state", async () => {
    City.findByPk.mockResolvedValue({ ...CITY, state_id: 5 });

    const response = await post(VALID);

    expect(response.status).toBe(422);
    expect(response.body).toEqual({
      errors: { city_id: "City does not belong to state" },
    });
    expect(Supplier.create).not.toHaveBeenCalled();
  });

  it("responds 409 when the identification already exists", async () => {
    Supplier.create.mockRejectedValue(
      new UniqueConstraintError({ message: "duplicate" }),
    );

    const response = await post(VALID);

    expect(response.status).toBe(409);
    expect(response.body).toEqual({ message: "Supplier already exists" });
  });

  it.each([
    {},
    { ...VALID, name: undefined },
    { ...VALID, identification: undefined },
    { ...VALID, email: undefined },
    { ...VALID, phone: undefined },
    { ...VALID, address: undefined },
    { ...VALID, city_id: undefined },
    { ...VALID, state_id: undefined },
    { ...VALID, name: "" },
  ])("responds 400 when a required field is missing in %p", async (body) => {
    const response = await post(body);

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ message: REQUIRED_MESSAGE });
    expect(Supplier.create).not.toHaveBeenCalled();
  });

  it.each([
    { ...VALID, name: "A" },
    { ...VALID, identification: "A-1" },
    { ...VALID, email: "not-an-email" },
    { ...VALID, phone: "123" },
    { ...VALID, address: "Av 1" },
    { ...VALID, city_id: 0 },
    { ...VALID, state_id: "abc" },
  ])("responds 422 when the body is invalid in %p", async (body) => {
    const response = await post(body);

    expect(response.status).toBe(422);
    expect(response.body.errors).toBeDefined();
    expect(Supplier.create).not.toHaveBeenCalled();
  });

  it("responds 401 without a token", async () => {
    const response = await post(VALID, null);

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ message: "Unauthorized" });
    expect(Supplier.create).not.toHaveBeenCalled();
  });

  it.each(["dispatcher", "manager_warehouse", "support", "customer"])(
    "responds 403 when the authenticated user is %s",
    async (role) => {
      const response = await post(VALID, tokenFor(role));

      expect(response.status).toBe(403);
      expect(response.body).toEqual({ message: "Forbidden" });
      expect(Supplier.create).not.toHaveBeenCalled();
    },
  );

  it("responds 403 when the authenticated user is blocked", async () => {
    User.findByPk.mockResolvedValue({ ...AUTH_USER, isBlocked: true });

    const response = await post(VALID);

    expect(response.status).toBe(403);
    expect(response.body).toEqual({ message: "User is blocked" });
    expect(Supplier.create).not.toHaveBeenCalled();
  });

  it("forwards unexpected persistence errors", async () => {
    Supplier.create.mockRejectedValue(new Error("database exploded"));

    const response = await post(VALID);

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ message: "Server error" });
  });
});
