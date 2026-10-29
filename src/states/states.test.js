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
const statesRouter = require("./index");

const app = express();
app.use(express.json());
app.use("/states", statesRouter);
app.use((error, req, res, next) => {
  res.status(500).json({ message: "Server error" });
});

const SECRET = "test-secret";
const AUTH_USER = { id: 1, username: "admin", isBlocked: false };
const validBody = { name: "Aragua", code: "VE-D" };

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
 * Sends a POST /states request.
 * @param {object} body - Request body.
 * @param {string|null} [token] - Bearer token, null to omit the header.
 * @returns {Promise<import("supertest").Response>} HTTP response.
 */
function post(body, token = tokenFor()) {
  const req = request(app).post("/states");

  return token
    ? req.set("Authorization", `Bearer ${token}`).send(body)
    : req.send(body);
}

beforeEach(() => {
  State.create.mockReset();
  State.findAll.mockReset();
  State.findByPk.mockReset();
  User.findByPk.mockReset();
  User.findByPk.mockResolvedValue(AUTH_USER);
});

describe("POST /states", () => {
  it.each(["admin", "seller"])(
    "allows a %s to create a state and answers 201",
    async (role) => {
      State.create.mockImplementation(async (values) => ({ id: 4, ...values }));

      const response = await post(validBody, tokenFor(role));

      expect(response.status).toBe(201);
      expect(response.body).toEqual({ id: 4, ...validBody });
      expect(State.create).toHaveBeenCalledWith(validBody);
    },
  );

  it("trims the name and uppercases the code before persisting", async () => {
    State.create.mockImplementation(async (values) => ({ id: 4, ...values }));

    const response = await post({ name: "  Aragua  ", code: " ve-d " });

    expect(response.status).toBe(201);
    expect(State.create).toHaveBeenCalledWith(validBody);
  });

  it("drops unknown and audit fields", async () => {
    State.create.mockImplementation(async (values) => ({ id: 4, ...values }));

    const response = await post({
      ...validBody,
      id: 99,
      createdAt: "2026-09-01",
      updatedAt: "2026-09-01",
      admin: true,
    });

    expect(response.status).toBe(201);
    expect(State.create).toHaveBeenCalledWith(validBody);
  });

  it("responds 409 when the name or code already exists", async () => {
    State.create.mockRejectedValue(
      new UniqueConstraintError({ message: "duplicate" }),
    );

    const response = await post(validBody);

    expect(response.status).toBe(409);
    expect(response.body).toEqual({ message: "State already exists" });
  });

  it.each([{}, { name: "Aragua" }, { code: "VE-D" }])(
    "responds 400 when a required field is missing in %p",
    async (body) => {
      const response = await post(body);

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ message: "name and code are required" });
      expect(State.create).not.toHaveBeenCalled();
    },
  );

  it.each([
    { name: "A", code: "VE-D" },
    { name: "Aragua", code: "V" },
  ])("responds 422 when the body is invalid in %p", async (body) => {
    const response = await post(body);

    expect(response.status).toBe(422);
    expect(response.body.errors).toBeDefined();
    expect(State.create).not.toHaveBeenCalled();
  });

  it("responds 401 without a token", async () => {
    const response = await post(validBody, null);

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ message: "Unauthorized" });
    expect(State.create).not.toHaveBeenCalled();
  });

  it("responds 401 when the token is invalid", async () => {
    const response = await post(validBody, "not-a-jwt");

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ message: "Unauthorized" });
  });

  it.each(["dispatcher", "manager_warehouse", "support", "customer"])(
    "responds 403 when the authenticated user is %s",
    async (role) => {
      const response = await post(validBody, tokenFor(role));

      expect(response.status).toBe(403);
      expect(response.body).toEqual({ message: "Forbidden" });
      expect(State.create).not.toHaveBeenCalled();
    },
  );

  it("responds 403 when the authenticated user is blocked", async () => {
    User.findByPk.mockResolvedValue({ ...AUTH_USER, isBlocked: true });

    const response = await post(validBody);

    expect(response.status).toBe(403);
    expect(response.body).toEqual({ message: "User is blocked" });
    expect(State.create).not.toHaveBeenCalled();
  });

  it("forwards unexpected persistence errors", async () => {
    State.create.mockRejectedValue(new Error("database exploded"));

    const response = await post(validBody);

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ message: "Server error" });
  });
});

describe("router composition", () => {
  it("mounts the list router on GET /states", async () => {
    State.findAll.mockResolvedValue([]);

    const response = await request(app)
      .get("/states")
      .set("Authorization", `Bearer ${tokenFor()}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual([]);
    expect(State.findAll).toHaveBeenCalledWith({
      order: [["name", "ASC"]],
    });
  });

  it("mounts the update router on PUT /states/:id", async () => {
    const state = {
      id: 1,
      name: "Aragua",
      code: "VE-D",
      update: jest.fn(function update(values) {
        Object.assign(this, values);
        return Promise.resolve(this);
      }),
    };
    State.findByPk.mockResolvedValue(state);

    const response = await request(app)
      .put("/states/1")
      .set("Authorization", `Bearer ${tokenFor()}`)
      .send({ code: "ve-e" });

    expect(response.status).toBe(202);
    expect(response.body).toEqual({ id: 1, name: "Aragua", code: "VE-E" });
  });

  it("mounts the remove router on DELETE /states/:id", async () => {
    const state = {
      id: 1,
      name: "Aragua",
      code: "VE-D",
      destroy: jest.fn().mockResolvedValue(),
    };
    State.findByPk.mockResolvedValue(state);

    const response = await request(app)
      .delete("/states/1")
      .set("Authorization", `Bearer ${tokenFor()}`);

    expect(response.status).toBe(204);
    expect(response.text).toBe("");
    expect(state.destroy).toHaveBeenCalledTimes(1);
  });
});
