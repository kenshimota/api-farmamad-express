process.env.JWT_SECRET = "test-secret";

jest.mock("../models/city", () => ({
  create: jest.fn(),
  findAll: jest.fn(),
  findByPk: jest.fn(),
}));
jest.mock("../models/state", () => ({ findByPk: jest.fn() }));
jest.mock("../models/user", () => ({ findByPk: jest.fn() }));

const express = require("express");
const request = require("supertest");
const jwt = require("jsonwebtoken");
const { UniqueConstraintError } = require("sequelize");
const City = require("../models/city");
const State = require("../models/state");
const User = require("../models/user");
const updateRouter = require("./update");

const app = express();
app.use(express.json());
app.use("/cities", updateRouter);
app.use((error, req, res, next) => {
  res.status(500).json({ message: "Server error" });
});

const SECRET = "test-secret";
const AUTH_USER = { id: 1, username: "admin", isBlocked: false };

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
 * Builds a stored city double with a working update method.
 * @param {object} [overrides] - Attribute overrides.
 * @returns {object} The city double.
 */
function target(overrides = {}) {
  return {
    id: 10,
    name: "Maracay",
    state_id: 4,
    update: jest.fn(function update(values) {
      Object.assign(this, values);
      return Promise.resolve(this);
    }),
    ...overrides,
  };
}

/**
 * Sends a PUT /cities/:id request.
 * @param {string} id - Route parameter.
 * @param {object} body - Request body.
 * @param {string|null} [token] - Bearer token, null to omit the header.
 * @returns {Promise<import("supertest").Response>} HTTP response.
 */
function put(id, body, token = tokenFor()) {
  const req = request(app).put(`/cities/${id}`);

  return token
    ? req.set("Authorization", `Bearer ${token}`).send(body)
    : req.send(body);
}

beforeEach(() => {
  City.findByPk.mockReset();
  State.findByPk.mockReset();
  State.findByPk.mockResolvedValue({ id: 5, name: "Carabobo", code: "VE-G" });
  User.findByPk.mockReset();
  User.findByPk.mockResolvedValue(AUTH_USER);
});

describe("PUT /cities/:id", () => {
  it.each(["admin", "seller"])(
    "allows a %s to update both fields and answers 202",
    async (role) => {
      const city = target();
      City.findByPk.mockResolvedValue(city);

      const response = await put(
        "10",
        { name: "Valencia", state_id: 5 },
        tokenFor(role),
      );

      expect(response.status).toBe(202);
      expect(response.body).toEqual({
        id: 10,
        name: "Valencia",
        state_id: 5,
      });
      expect(city.update).toHaveBeenCalledWith({
        name: "Valencia",
        state_id: 5,
      });
      expect(response.body).not.toHaveProperty("createdAt");
      expect(response.body).not.toHaveProperty("updatedAt");
    },
  );

  it("updates only the name when state_id is omitted", async () => {
    const city = target();
    City.findByPk.mockResolvedValue(city);

    const response = await put("10", { name: "  Turmero  " });

    expect(response.status).toBe(202);
    expect(city.update).toHaveBeenCalledWith({ name: "Turmero" });
    expect(State.findByPk).not.toHaveBeenCalled();
  });

  it("updates only state_id and checks that the state exists", async () => {
    const city = target();
    City.findByPk.mockResolvedValue(city);

    const response = await put("10", { state_id: 5 });

    expect(response.status).toBe(202);
    expect(State.findByPk).toHaveBeenCalledWith(5);
    expect(city.update).toHaveBeenCalledWith({ state_id: 5 });
  });

  it("responds 422 when the new state does not exist", async () => {
    State.findByPk.mockResolvedValue(null);

    const response = await put("10", { state_id: 999 });

    expect(response.status).toBe(422);
    expect(response.body).toEqual({ errors: { state_id: "Invalid state" } });
    expect(City.findByPk).not.toHaveBeenCalled();
  });

  it("responds 409 when the city already exists in the state", async () => {
    const city = target();
    city.update.mockRejectedValue(
      new UniqueConstraintError({ message: "duplicate" }),
    );
    City.findByPk.mockResolvedValue(city);

    const response = await put("10", { name: "Turmero" });

    expect(response.status).toBe(409);
    expect(response.body).toEqual({ message: "City already exists" });
  });

  it("responds 404 when the city does not exist", async () => {
    City.findByPk.mockResolvedValue(null);

    const response = await put("999", { name: "Turmero" });

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ message: "City not found" });
  });

  it.each(["abc", "0", "-1", "1.5"])(
    "responds 422 when the id is %s",
    async (id) => {
      const response = await put(id, { name: "Turmero" });

      expect(response.status).toBe(422);
      expect(response.body).toEqual({
        errors: { id: "Invalid city id" },
      });
      expect(City.findByPk).not.toHaveBeenCalled();
    },
  );

  it("responds 400 when no field is provided", async () => {
    const response = await put("10", {});

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      message: "name or state_id is required",
    });
    expect(City.findByPk).not.toHaveBeenCalled();
  });

  it.each([
    [{ name: "A" }, { name: "Nombre inválido" }],
    [{ name: "   " }, { name: "Nombre inválido" }],
    [{ state_id: 0 }, { state_id: "Invalid state" }],
    [{ state_id: null }, { state_id: "Invalid state" }],
  ])(
    "responds 422 when a provided field is invalid in %p",
    async (body, errors) => {
      const response = await put("10", body);

      expect(response.status).toBe(422);
      expect(response.body).toEqual({ errors });
      expect(City.findByPk).not.toHaveBeenCalled();
    },
  );

  it("responds 401 when the token is missing", async () => {
    const response = await put("10", { name: "Turmero" }, null);

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ message: "Unauthorized" });
    expect(City.findByPk).not.toHaveBeenCalled();
  });

  it.each(["dispatcher", "manager_warehouse", "support", "customer"])(
    "responds 403 when the authenticated user is %s",
    async (role) => {
      const response = await put("10", { name: "Turmero" }, tokenFor(role));

      expect(response.status).toBe(403);
      expect(response.body).toEqual({ message: "Forbidden" });
      expect(City.findByPk).not.toHaveBeenCalled();
    },
  );

  it("responds 403 when the authenticated user is blocked", async () => {
    User.findByPk.mockResolvedValue({ ...AUTH_USER, isBlocked: true });

    const response = await put("10", { name: "Turmero" });

    expect(response.status).toBe(403);
    expect(response.body).toEqual({ message: "User is blocked" });
  });

  it("forwards unexpected persistence errors", async () => {
    const city = target();
    city.update.mockRejectedValue(new Error("database exploded"));
    City.findByPk.mockResolvedValue(city);

    const response = await put("10", { name: "Turmero" });

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ message: "Server error" });
  });
});
