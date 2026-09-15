process.env.JWT_SECRET = "test-secret";

jest.mock("../models/user", () => ({
  findByPk: jest.fn(),
  findAll: jest.fn(),
}));
jest.mock("../models/role", () => ({ findOne: jest.fn() }));
jest.mock("../database", () => ({ transaction: jest.fn() }));

const express = require("express");
const request = require("supertest");
const jwt = require("jsonwebtoken");
const User = require("../models/user");
const Role = require("../models/role");
const listRouter = require("./list");

const app = express();
app.use(express.json());
app.use("/users", listRouter);

const SECRET = "test-secret";
const AUTH_USER = { id: 1, username: "admin", isBlocked: false };
const storedUsers = [
  {
    id: 1,
    username: "admin",
    email: "admin@breadking.com",
    name: "Administrador",
    isBlocked: false,
    role: { name: "admin" },
  },
  {
    id: 2,
    username: "maria",
    email: "maria@breadking.com",
    name: "María",
    isBlocked: true,
    role: { name: "seller" },
  },
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
 * Sends a GET /users request.
 * @param {string|null} [token] - Bearer token, null to omit the header.
 * @returns {Promise<import("supertest").Response>} HTTP response.
 */
function get(token = tokenFor()) {
  const req = request(app).get("/users");

  return token ? req.set("Authorization", `Bearer ${token}`) : req;
}

beforeEach(() => {
  User.findByPk.mockReset();
  User.findAll.mockReset();
  Role.findOne.mockReset();
  User.findByPk.mockResolvedValue(AUTH_USER);
});

describe("GET /users", () => {
  it("returns every user ordered by id with the public fields", async () => {
    User.findAll.mockResolvedValue(storedUsers);

    const response = await get();

    expect(response.status).toBe(200);
    expect(response.body).toEqual([
      {
        id: 1,
        username: "admin",
        email: "admin@breadking.com",
        name: "Administrador",
        role: "admin",
        isBlocked: false,
      },
      {
        id: 2,
        username: "maria",
        email: "maria@breadking.com",
        name: "María",
        role: "seller",
        isBlocked: true,
      },
    ]);
    expect(response.body[0]).not.toHaveProperty("password");
    expect(response.body[0]).not.toHaveProperty("roleId");
    expect(User.findAll).toHaveBeenCalledWith({
      include: { model: Role, as: "role" },
      order: [["id", "ASC"]],
    });
  });

  it("returns an empty array when there are no users", async () => {
    User.findAll.mockResolvedValue([]);

    const response = await get();

    expect(response.status).toBe(200);
    expect(response.body).toEqual([]);
  });

  it("responds 401 without a token", async () => {
    const response = await get(null);

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ message: "Unauthorized" });
    expect(User.findAll).not.toHaveBeenCalled();
  });

  it("responds 401 when the token is invalid", async () => {
    const response = await get("not-a-jwt");

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ message: "Unauthorized" });
    expect(User.findAll).not.toHaveBeenCalled();
  });

  it.each(["seller", "delivery", "freelance_delivery", "customer"])(
    "responds 403 when the authenticated user is %s",
    async (role) => {
      const response = await get(tokenFor(role));

      expect(response.status).toBe(403);
      expect(response.body).toEqual({ message: "Forbidden" });
      expect(User.findAll).not.toHaveBeenCalled();
    },
  );

  it("responds 403 when the authenticated administrator is blocked", async () => {
    User.findByPk.mockResolvedValue({ ...AUTH_USER, isBlocked: true });

    const response = await get();

    expect(response.status).toBe(403);
    expect(response.body).toEqual({ message: "User is blocked" });
    expect(User.findAll).not.toHaveBeenCalled();
  });

  it("responds 401 when the token belongs to a deleted user", async () => {
    User.findByPk.mockResolvedValue(null);

    const response = await get();

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ message: "Unauthorized" });
    expect(User.findAll).not.toHaveBeenCalled();
  });
});
