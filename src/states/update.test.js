process.env.JWT_SECRET = "test-secret";

jest.mock("../models/state", () => ({
  create: jest.fn(),
  findAll: jest.fn(),
  findByPk: jest.fn(),
}));
jest.mock("../models/user", () => ({ findByPk: jest.fn() }));

const express = require("express");
const request = require("supertest");
const jwt = require("jsonwebtoken");
const { UniqueConstraintError } = require("sequelize");
const State = require("../models/state");
const User = require("../models/user");
const updateRouter = require("./update");

const app = express();
app.use(express.json());
app.use("/states", updateRouter);
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
 * Builds a stored state double with a working update method.
 * @param {object} [overrides] - Attribute overrides.
 * @returns {object} The state double.
 */
function target(overrides = {}) {
  return {
    id: 1,
    name: "Aragua",
    code: "VE-D",
    update: jest.fn(function update(values) {
      Object.assign(this, values);
      return Promise.resolve(this);
    }),
    ...overrides,
  };
}

/**
 * Sends a PUT /states/:id request.
 * @param {string} id - Route parameter.
 * @param {object} body - Request body.
 * @param {string|null} [token] - Bearer token, null to omit the header.
 * @returns {Promise<import("supertest").Response>} HTTP response.
 */
function put(id, body, token = tokenFor()) {
  const req = request(app).put(`/states/${id}`);

  return token
    ? req.set("Authorization", `Bearer ${token}`).send(body)
    : req.send(body);
}

beforeEach(() => {
  State.findByPk.mockReset();
  User.findByPk.mockReset();
  User.findByPk.mockResolvedValue(AUTH_USER);
});

describe("PUT /states/:id", () => {
  it.each(["admin", "seller"])(
    "allows a %s to update both fields and answers 202",
    async (role) => {
      const state = target();
      State.findByPk.mockResolvedValue(state);

      const response = await put(
        "1",
        { name: "Aragua", code: "VE-E" },
        tokenFor(role),
      );

      expect(response.status).toBe(202);
      expect(response.body).toEqual({ id: 1, name: "Aragua", code: "VE-E" });
      expect(state.update).toHaveBeenCalledWith({
        name: "Aragua",
        code: "VE-E",
      });
      expect(response.body).not.toHaveProperty("createdAt");
      expect(response.body).not.toHaveProperty("updatedAt");
    },
  );

  it("updates only the name when the code is omitted", async () => {
    const state = target();
    State.findByPk.mockResolvedValue(state);

    const response = await put("1", { name: "  Aragua  " });

    expect(response.status).toBe(202);
    expect(state.update).toHaveBeenCalledWith({ name: "Aragua" });
  });

  it("updates only the code and stores it uppercased", async () => {
    const state = target();
    State.findByPk.mockResolvedValue(state);

    const response = await put("1", { code: " ve-e " });

    expect(response.status).toBe(202);
    expect(state.update).toHaveBeenCalledWith({ code: "VE-E" });
    expect(response.body.code).toBe("VE-E");
  });

  it("drops unknown and audit fields", async () => {
    const state = target();
    State.findByPk.mockResolvedValue(state);

    const response = await put("1", {
      name: "Aragua",
      id: 99,
      createdAt: "2026-09-01",
      updatedAt: "2026-09-01",
      admin: true,
    });

    expect(response.status).toBe(202);
    expect(state.update).toHaveBeenCalledWith({ name: "Aragua" });
  });

  it("responds 409 when the new name or code belongs to another state", async () => {
    const state = target();
    state.update.mockRejectedValue(
      new UniqueConstraintError({ message: "duplicate" }),
    );
    State.findByPk.mockResolvedValue(state);

    const response = await put("1", { name: "Amazonas" });

    expect(response.status).toBe(409);
    expect(response.body).toEqual({ message: "State already exists" });
  });

  it("responds 404 when the state does not exist", async () => {
    State.findByPk.mockResolvedValue(null);

    const response = await put("999", { name: "Aragua" });

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ message: "State not found" });
  });

  it.each(["abc", "0", "-1", "1.5"])(
    "responds 422 when the id is %s",
    async (id) => {
      const response = await put(id, { name: "Aragua" });

      expect(response.status).toBe(422);
      expect(response.body).toEqual({
        errors: { id: "Invalid state id" },
      });
      expect(State.findByPk).not.toHaveBeenCalled();
    },
  );

  it("responds 400 when no field is provided", async () => {
    const response = await put("1", {});

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      message: "name or code is required",
    });
    expect(State.findByPk).not.toHaveBeenCalled();
  });

  it.each([
    [{ name: "A" }, { name: "Nombre inválido" }],
    [{ name: "   " }, { name: "Nombre inválido" }],
    [{ code: "V" }, { code: "Código inválido" }],
    [{ code: null }, { code: "Código inválido" }],
  ])(
    "responds 422 when a provided field is invalid in %p",
    async (body, errors) => {
      const response = await put("1", body);

      expect(response.status).toBe(422);
      expect(response.body).toEqual({ errors });
      expect(State.findByPk).not.toHaveBeenCalled();
    },
  );

  it("responds 401 when the token is missing", async () => {
    const response = await put("1", { name: "Aragua" }, null);

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ message: "Unauthorized" });
    expect(State.findByPk).not.toHaveBeenCalled();
  });

  it.each(["dispatcher", "manager_warehouse", "support", "customer"])(
    "responds 403 when the authenticated user is %s",
    async (role) => {
      const response = await put("1", { name: "Aragua" }, tokenFor(role));

      expect(response.status).toBe(403);
      expect(response.body).toEqual({ message: "Forbidden" });
      expect(State.findByPk).not.toHaveBeenCalled();
    },
  );

  it("responds 403 when the authenticated user is blocked", async () => {
    User.findByPk.mockResolvedValue({ ...AUTH_USER, isBlocked: true });

    const response = await put("1", { name: "Aragua" });

    expect(response.status).toBe(403);
    expect(response.body).toEqual({ message: "User is blocked" });
  });

  it("forwards unexpected persistence errors", async () => {
    const state = target();
    state.update.mockRejectedValue(new Error("database exploded"));
    State.findByPk.mockResolvedValue(state);

    const response = await put("1", { name: "Aragua" });

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ message: "Server error" });
  });
});
