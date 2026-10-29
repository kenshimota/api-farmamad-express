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
const citiesRouter = require("./index");

const app = express();
app.use(express.json());
app.use("/cities", citiesRouter);
app.use((error, req, res, next) => {
  res.status(500).json({ message: "Server error" });
});

const SECRET = "test-secret";
const AUTH_USER = { id: 1, username: "admin", isBlocked: false };
const validBody = { name: "Maracay", state_id: 4 };

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
 * Sends a POST /cities request.
 * @param {object} body - Request body.
 * @param {string|null} [token] - Bearer token, null to omit the header.
 * @returns {Promise<import("supertest").Response>} HTTP response.
 */
function post(body, token = tokenFor()) {
  const req = request(app).post("/cities");

  return token
    ? req.set("Authorization", `Bearer ${token}`).send(body)
    : req.send(body);
}

beforeEach(() => {
  City.create.mockReset();
  City.findAll.mockReset();
  City.findByPk.mockReset();
  State.findByPk.mockReset();
  State.findByPk.mockResolvedValue({ id: 4, name: "Aragua", code: "VE-D" });
  User.findByPk.mockReset();
  User.findByPk.mockResolvedValue(AUTH_USER);
});

describe("POST /cities", () => {
  it.each(["admin", "seller"])(
    "allows a %s to create a city and answers 201",
    async (role) => {
      City.create.mockImplementation(async (values) => ({ id: 10, ...values }));

      const response = await post(validBody, tokenFor(role));

      expect(response.status).toBe(201);
      expect(response.body).toEqual({ id: 10, ...validBody });
      expect(City.create).toHaveBeenCalledWith(validBody);
      expect(State.findByPk).toHaveBeenCalledWith(4);
    },
  );

  it("trims the name before persisting it", async () => {
    City.create.mockImplementation(async (values) => ({ id: 10, ...values }));

    const response = await post({ name: "  Maracay  ", state_id: 4 });

    expect(response.status).toBe(201);
    expect(City.create).toHaveBeenCalledWith(validBody);
  });

  it("drops unknown and audit fields", async () => {
    City.create.mockImplementation(async (values) => ({ id: 10, ...values }));

    const response = await post({
      ...validBody,
      id: 99,
      createdAt: "2026-09-01",
      updatedAt: "2026-09-01",
      admin: true,
    });

    expect(response.status).toBe(201);
    expect(City.create).toHaveBeenCalledWith(validBody);
  });

  it("responds 422 when the state does not exist", async () => {
    State.findByPk.mockResolvedValue(null);

    const response = await post({ name: "Maracay", state_id: 999 });

    expect(response.status).toBe(422);
    expect(response.body).toEqual({ errors: { state_id: "Invalid state" } });
    expect(City.create).not.toHaveBeenCalled();
  });

  it("responds 409 when the city already exists in the state", async () => {
    City.create.mockRejectedValue(
      new UniqueConstraintError({ message: "duplicate" }),
    );

    const response = await post(validBody);

    expect(response.status).toBe(409);
    expect(response.body).toEqual({ message: "City already exists" });
  });

  it.each([{}, { name: "Maracay" }, { state_id: 4 }, { name: "" }])(
    "responds 400 when a required field is missing in %p",
    async (body) => {
      const response = await post(body);

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        message: "name and state_id are required",
      });
      expect(City.create).not.toHaveBeenCalled();
    },
  );

  it.each([
    { name: "A", state_id: 4 },
    { name: "Maracay", state_id: 0 },
    { name: "Maracay", state_id: "abc" },
  ])("responds 422 when the body is invalid in %p", async (body) => {
    const response = await post(body);

    expect(response.status).toBe(422);
    expect(response.body.errors).toBeDefined();
    expect(City.create).not.toHaveBeenCalled();
  });

  it("responds 401 without a token", async () => {
    const response = await post(validBody, null);

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ message: "Unauthorized" });
    expect(City.create).not.toHaveBeenCalled();
  });

  it.each(["dispatcher", "manager_warehouse", "support", "customer"])(
    "responds 403 when the authenticated user is %s",
    async (role) => {
      const response = await post(validBody, tokenFor(role));

      expect(response.status).toBe(403);
      expect(response.body).toEqual({ message: "Forbidden" });
      expect(City.create).not.toHaveBeenCalled();
    },
  );

  it("responds 403 when the authenticated user is blocked", async () => {
    User.findByPk.mockResolvedValue({ ...AUTH_USER, isBlocked: true });

    const response = await post(validBody);

    expect(response.status).toBe(403);
    expect(response.body).toEqual({ message: "User is blocked" });
    expect(City.create).not.toHaveBeenCalled();
  });

  it("forwards unexpected persistence errors", async () => {
    City.create.mockRejectedValue(new Error("database exploded"));

    const response = await post(validBody);

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ message: "Server error" });
  });
});

describe("router composition", () => {
  it("mounts the list router on GET /cities", async () => {
    City.findAll.mockResolvedValue([]);

    const response = await request(app)
      .get("/cities")
      .set("Authorization", `Bearer ${tokenFor()}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual([]);
    expect(City.findAll).toHaveBeenCalledWith({
      order: [["id", "ASC"]],
    });
  });

  it("mounts the update router on PUT /cities/:id", async () => {
    const city = {
      id: 10,
      name: "Maracay",
      state_id: 4,
      update: jest.fn(function update(values) {
        Object.assign(this, values);
        return Promise.resolve(this);
      }),
    };
    City.findByPk.mockResolvedValue(city);

    const response = await request(app)
      .put("/cities/10")
      .set("Authorization", `Bearer ${tokenFor()}`)
      .send({ name: "Turmero" });

    expect(response.status).toBe(202);
    expect(response.body).toEqual({ id: 10, name: "Turmero", state_id: 4 });
  });

  it("mounts the remove router on DELETE /cities/:id", async () => {
    const city = {
      id: 10,
      name: "Maracay",
      state_id: 4,
      destroy: jest.fn().mockResolvedValue(),
    };
    City.findByPk.mockResolvedValue(city);

    const response = await request(app)
      .delete("/cities/10")
      .set("Authorization", `Bearer ${tokenFor()}`);

    expect(response.status).toBe(204);
    expect(response.text).toBe("");
    expect(city.destroy).toHaveBeenCalledTimes(1);
  });
});
