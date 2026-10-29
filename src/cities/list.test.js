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
const City = require("../models/city");
const State = require("../models/state");
const User = require("../models/user");
const listRouter = require("./list");

const app = express();
app.use(express.json());
app.use("/cities", listRouter);

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
const STATE = { id: 4, name: "Aragua", code: "VE-D" };
const storedCities = [
  { id: 10, name: "Maracay", state_id: 4 },
  { id: 11, name: "Turmero", state_id: 4 },
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
 * @param {string} path - Request path under /cities.
 * @param {string|null} [token] - Bearer token, null to omit the header.
 * @returns {Promise<import("supertest").Response>} HTTP response.
 */
function get(path, token = tokenFor()) {
  const req = request(app).get(`/cities${path}`);

  return token ? req.set("Authorization", `Bearer ${token}`) : req;
}

beforeEach(() => {
  City.findAll.mockReset();
  City.findByPk.mockReset();
  State.findByPk.mockReset();
  User.findByPk.mockReset();
  User.findByPk.mockResolvedValue(AUTH_USER);
});

describe("GET /cities", () => {
  it.each(ALL_ROLES)(
    "returns the public cities for an authenticated %s",
    async (role) => {
      City.findAll.mockResolvedValue(storedCities);

      const response = await get("/", tokenFor(role));

      expect(response.status).toBe(200);
      expect(response.body).toEqual(storedCities);
      expect(response.body[0]).not.toHaveProperty("createdAt");
      expect(response.body[0]).not.toHaveProperty("updatedAt");
      expect(City.findAll).toHaveBeenCalledWith({
        order: [["id", "ASC"]],
      });
    },
  );

  it("returns an empty array when there are no cities", async () => {
    City.findAll.mockResolvedValue([]);

    const response = await get("/");

    expect(response.status).toBe(200);
    expect(response.body).toEqual([]);
  });

  it("filters by state_id with an exact match", async () => {
    City.findAll.mockResolvedValue([storedCities[0]]);

    const response = await get("/?state_id=4");

    expect(response.status).toBe(200);
    expect(City.findAll).toHaveBeenCalledWith({
      order: [["id", "ASC"]],
      where: { state_id: 4 },
    });
  });

  it("nests the state only when include=state is requested", async () => {
    City.findAll.mockResolvedValue([{ ...storedCities[0], state: STATE }]);

    const response = await get("/?include=state");

    expect(response.status).toBe(200);
    expect(response.body).toEqual([{ ...storedCities[0], state: STATE }]);
    expect(City.findAll).toHaveBeenCalledWith({
      order: [["id", "ASC"]],
      include: [{ model: State, as: "state" }],
    });
  });

  it("combines the filter and the nested state", async () => {
    City.findAll.mockResolvedValue([{ ...storedCities[0], state: STATE }]);

    const response = await get("/?state_id=4&include=state");

    expect(response.status).toBe(200);
    expect(City.findAll).toHaveBeenCalledWith({
      order: [["id", "ASC"]],
      where: { state_id: 4 },
      include: [{ model: State, as: "state" }],
    });
  });

  it("ignores an include value different from state", async () => {
    City.findAll.mockResolvedValue(storedCities);

    const response = await get("/?include=city");

    expect(response.status).toBe(200);
    expect(response.body[0]).not.toHaveProperty("state");
    expect(City.findAll).toHaveBeenCalledWith({
      order: [["id", "ASC"]],
    });
  });

  it.each(["abc", "0", "-1", "1.5"])(
    "responds 422 when state_id is %s",
    async (stateId) => {
      const response = await get(`/?state_id=${stateId}`);

      expect(response.status).toBe(422);
      expect(response.body).toEqual({
        errors: { state_id: "Invalid state" },
      });
      expect(City.findAll).not.toHaveBeenCalled();
    },
  );

  it("responds 401 without a token", async () => {
    const response = await get("/", null);

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ message: "Unauthorized" });
    expect(City.findAll).not.toHaveBeenCalled();
  });

  it("responds 403 when the authenticated user is blocked", async () => {
    User.findByPk.mockResolvedValue({ ...AUTH_USER, isBlocked: true });

    const response = await get("/");

    expect(response.status).toBe(403);
    expect(response.body).toEqual({ message: "User is blocked" });
    expect(City.findAll).not.toHaveBeenCalled();
  });
});

describe("GET /cities/:id", () => {
  it.each(ALL_ROLES)(
    "returns one public city for an authenticated %s",
    async (role) => {
      City.findByPk.mockResolvedValue(storedCities[0]);

      const response = await get("/10", tokenFor(role));

      expect(response.status).toBe(200);
      expect(response.body).toEqual(storedCities[0]);
      expect(response.body).not.toHaveProperty("state");
      expect(City.findByPk).toHaveBeenCalledWith(10);
    },
  );

  it("responds 404 when the city does not exist", async () => {
    City.findByPk.mockResolvedValue(null);

    const response = await get("/999");

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ message: "City not found" });
  });

  it.each(["abc", "0", "-1", "1.5"])(
    "responds 422 when the id is %s",
    async (id) => {
      const response = await get(`/${id}`);

      expect(response.status).toBe(422);
      expect(response.body).toEqual({
        errors: { id: "Invalid city id" },
      });
      expect(City.findByPk).not.toHaveBeenCalled();
    },
  );

  it("responds 401 without a token", async () => {
    const response = await get("/10", null);

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ message: "Unauthorized" });
  });
});
