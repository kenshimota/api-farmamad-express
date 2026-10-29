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
const State = require("../models/state");
const User = require("../models/user");
const listRouter = require("./list");

const app = express();
app.use(express.json());
app.use("/states", listRouter);

const SECRET = "test-secret";
const AUTH_USER = { id: 1, username: "admin", isBlocked: false };
const ALL_ROLES = [
  "admin",
  "seller",
  "dispatcher",
  "manager_warehouse",
  "support",
  "customer",
];
const storedStates = [
  { id: 1, name: "Amazonas", code: "VE-Z" },
  { id: 2, name: "Anzoátegui", code: "VE-B" },
];

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
 * Sends a GET request with an optional bearer token.
 * @param {string} path - Request path under /states.
 * @param {string|null} [token] - Bearer token, null to omit the header.
 * @returns {Promise<import("supertest").Response>} HTTP response.
 */
function get(path, token = tokenFor()) {
  const req = request(app).get(`/states${path}`);

  return token ? req.set("Authorization", `Bearer ${token}`) : req;
}

beforeEach(() => {
  State.create.mockReset();
  State.findAll.mockReset();
  State.findByPk.mockReset();
  User.findByPk.mockReset();
  User.findByPk.mockResolvedValue(AUTH_USER);
});

describe("GET /states", () => {
  it.each(ALL_ROLES)(
    "returns the public states for an authenticated %s",
    async (role) => {
      State.findAll.mockResolvedValue(storedStates);

      const response = await get("/", tokenFor(role));

      expect(response.status).toBe(200);
      expect(response.body).toEqual(storedStates);
      expect(response.body[0]).not.toHaveProperty("createdAt");
      expect(response.body[0]).not.toHaveProperty("updatedAt");
      expect(State.findAll).toHaveBeenCalledWith({
        order: [["name", "ASC"]],
      });
    },
  );

  it("returns an empty array when there are no states", async () => {
    State.findAll.mockResolvedValue([]);

    const response = await get("/");

    expect(response.status).toBe(200);
    expect(response.body).toEqual([]);
  });

  it("responds 401 without a token", async () => {
    const response = await get("/", null);

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ message: "Unauthorized" });
    expect(State.findAll).not.toHaveBeenCalled();
  });

  it("responds 403 when the authenticated user is blocked", async () => {
    User.findByPk.mockResolvedValue({ ...AUTH_USER, isBlocked: true });

    const response = await get("/");

    expect(response.status).toBe(403);
    expect(response.body).toEqual({ message: "User is blocked" });
    expect(State.findAll).not.toHaveBeenCalled();
  });
});

describe("GET /states/:id", () => {
  it.each(ALL_ROLES)(
    "returns one public state for an authenticated %s",
    async (role) => {
      State.findByPk.mockResolvedValue(storedStates[0]);

      const response = await get("/1", tokenFor(role));

      expect(response.status).toBe(200);
      expect(response.body).toEqual(storedStates[0]);
      expect(State.findByPk).toHaveBeenCalledWith(1);
    },
  );

  it("responds 404 when the state does not exist", async () => {
    State.findByPk.mockResolvedValue(null);

    const response = await get("/999");

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ message: "State not found" });
  });

  it.each(["abc", "0", "-1", "1.5"])(
    "responds 422 when the id is %s",
    async (id) => {
      const response = await get(`/${id}`);

      expect(response.status).toBe(422);
      expect(response.body).toEqual({
        errors: { id: "Invalid state id" },
      });
      expect(State.findByPk).not.toHaveBeenCalled();
    },
  );

  it("responds 401 without a token", async () => {
    const response = await get("/1", null);

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ message: "Unauthorized" });
  });
});
