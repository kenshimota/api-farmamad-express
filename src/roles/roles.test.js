process.env.JWT_SECRET = "test-secret";

jest.mock("../models/user", () => ({
  findByPk: jest.fn(),
}));
jest.mock("../models/role", () => ({
  findAll: jest.fn(),
}));

const express = require("express");
const request = require("supertest");
const jwt = require("jsonwebtoken");
const User = require("../models/user");
const Role = require("../models/role");
const rolesRouter = require("./index");

const app = express();
app.use(express.json());
app.use("/roles", rolesRouter);

const SECRET = "test-secret";
const AUTH_USER = { id: 1, username: "admin", isBlocked: false };
const storedRoles = [
  { id: 1, name: "admin", createdAt: new Date("2026-09-10T00:00:00Z") },
  { id: 2, name: "customer", createdAt: new Date("2026-09-10T00:00:00Z") },
  { id: 3, name: "seller", createdAt: new Date("2026-09-10T00:00:00Z") },
  { id: 4, name: "dispatcher", createdAt: new Date("2026-09-10T00:00:00Z") },
  {
    id: 5,
    name: "manager_warehouse",
    createdAt: new Date("2026-09-10T00:00:00Z"),
  },
  { id: 6, name: "support", createdAt: new Date("2026-09-10T00:00:00Z") },
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
 * Sends a GET /roles request.
 * @param {string|null} [token] - Bearer token, null to omit the header.
 * @returns {Promise<import("supertest").Response>} HTTP response.
 */
function get(token = tokenFor()) {
  const req = request(app).get("/roles");

  return token ? req.set("Authorization", `Bearer ${token}`) : req;
}

beforeEach(() => {
  User.findByPk.mockReset();
  Role.findAll.mockReset();
  User.findByPk.mockResolvedValue(AUTH_USER);
});

describe("GET /roles", () => {
  it("returns the role catalog ordered by id with only id and name", async () => {
    Role.findAll.mockResolvedValue(storedRoles);

    const response = await get();

    expect(response.status).toBe(200);
    expect(response.body).toEqual([
      { id: 1, name: "admin" },
      { id: 2, name: "customer" },
      { id: 3, name: "seller" },
      { id: 4, name: "dispatcher" },
      { id: 5, name: "manager_warehouse" },
      { id: 6, name: "support" },
    ]);
    expect(response.body[0]).not.toHaveProperty("createdAt");
    expect(response.body[0]).not.toHaveProperty("updatedAt");
    expect(Role.findAll).toHaveBeenCalledWith({ order: [["id", "ASC"]] });
  });

  it("returns an empty array when there are no roles", async () => {
    Role.findAll.mockResolvedValue([]);

    const response = await get();

    expect(response.status).toBe(200);
    expect(response.body).toEqual([]);
  });

  it("responds 401 without a token", async () => {
    const response = await get(null);

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ message: "Unauthorized" });
    expect(Role.findAll).not.toHaveBeenCalled();
  });

  it("responds 401 when the token is invalid", async () => {
    const response = await get("not-a-jwt");

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ message: "Unauthorized" });
    expect(Role.findAll).not.toHaveBeenCalled();
  });

  it("responds 401 when the token is expired", async () => {
    const expired = jwt.sign(
      { sub: 1, username: "admin", role: "admin" },
      SECRET,
      {
        expiresIn: "-1s",
      },
    );

    const response = await get(expired);

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ message: "Unauthorized" });
    expect(Role.findAll).not.toHaveBeenCalled();
  });

  it.each(["seller", "dispatcher", "manager_warehouse", "support", "customer"])(
    "responds 403 when the authenticated user is %s",
    async (role) => {
      const response = await get(tokenFor(role));

      expect(response.status).toBe(403);
      expect(response.body).toEqual({ message: "Forbidden" });
      expect(Role.findAll).not.toHaveBeenCalled();
    },
  );

  it("responds 403 when the authenticated administrator is blocked", async () => {
    User.findByPk.mockResolvedValue({ ...AUTH_USER, isBlocked: true });

    const response = await get();

    expect(response.status).toBe(403);
    expect(response.body).toEqual({ message: "User is blocked" });
    expect(Role.findAll).not.toHaveBeenCalled();
  });

  it("responds 401 when the token belongs to a deleted user", async () => {
    User.findByPk.mockResolvedValue(null);

    const response = await get();

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ message: "Unauthorized" });
    expect(Role.findAll).not.toHaveBeenCalled();
  });
});
