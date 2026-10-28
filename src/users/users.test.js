process.env.JWT_SECRET = "test-secret";

jest.mock("../models/user", () => ({ create: jest.fn() }));
jest.mock("../models/role", () => ({ findOne: jest.fn() }));

const express = require("express");
const request = require("supertest");
const jwt = require("jsonwebtoken");
const { UniqueConstraintError } = require("sequelize");
const User = require("../models/user");
const Role = require("../models/role");
const usersRouter = require("./index");

const app = express();
app.use(express.json());
app.use("/users", usersRouter);
app.use((error, req, res, next) => {
  res.status(500).json({ message: "Server error" });
});

const SECRET = "test-secret";
const SELLER_ROLE = { id: 2, name: "seller" };
const validBody = {
  username: "maria",
  email: "maria@farmamad.com",
  password: "secret123",
  name: "María",
  role: "seller",
};
const createdUser = {
  id: 2,
  username: "maria",
  email: "maria@farmamad.com",
  name: "María",
  roleId: SELLER_ROLE.id,
};

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
 * Sends a POST /users request.
 * @param {object} body - Request body.
 * @param {string|null} [token] - Bearer token, null to omit the header.
 * @returns {Promise<import("supertest").Response>} HTTP response.
 */
function post(body, token = tokenFor()) {
  const req = request(app).post("/users");
  return token
    ? req.set("Authorization", `Bearer ${token}`).send(body)
    : req.send(body);
}

beforeEach(() => {
  User.create.mockReset();
  Role.findOne.mockReset();
});

describe("POST /users", () => {
  it("allows an administrator to create a user with a valid role", async () => {
    Role.findOne.mockResolvedValue(SELLER_ROLE);
    User.create.mockResolvedValue(createdUser);

    const response = await post(validBody);

    expect(response.status).toBe(201);
    expect(response.body).toEqual({
      id: 2,
      username: "maria",
      email: "maria@farmamad.com",
      name: "María",
      role: "seller",
    });
    expect(response.body).not.toHaveProperty("password");
    expect(response.body).not.toHaveProperty("roleId");
    expect(Role.findOne).toHaveBeenCalledWith({
      where: { name: "seller" },
    });
    expect(User.create).toHaveBeenCalledWith({
      username: "maria",
      email: "maria@farmamad.com",
      password: "secret123",
      name: "María",
      role: "seller",
      roleId: 2,
    });
  });

  it("creates a user without the optional name", async () => {
    Role.findOne.mockResolvedValue(SELLER_ROLE);
    User.create.mockResolvedValue({ ...createdUser, name: null });

    const response = await post({ ...validBody, name: undefined });

    expect(response.status).toBe(201);
    expect(response.body).toEqual({
      id: 2,
      username: "maria",
      email: "maria@farmamad.com",
      name: null,
      role: "seller",
    });
  });

  it("responds 401 when the token is missing", async () => {
    const response = await post(validBody, null);

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ message: "Unauthorized" });
    expect(User.create).not.toHaveBeenCalled();
  });

  it("responds 401 when the token is invalid", async () => {
    const response = await post(validBody, "not-a-jwt");

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ message: "Unauthorized" });
    expect(User.create).not.toHaveBeenCalled();
  });

  it.each(["seller", "delivery", "freelance_delivery", "customer"])(
    "responds 403 when the authenticated user is %s",
    async (role) => {
      const response = await post(validBody, tokenFor(role));

      expect(response.status).toBe(403);
      expect(response.body).toEqual({ message: "Forbidden" });
      expect(User.create).not.toHaveBeenCalled();
    },
  );

  it.each([
    [
      "all fields are missing",
      {},
      "username, email, password and role are required",
    ],
    [
      "role is missing",
      { username: "maria", email: "m@b.com", password: "secret123" },
      "role is required",
    ],
    [
      "email is missing",
      { username: "maria", password: "secret123", role: "seller" },
      "email is required",
    ],
  ])("responds 400 when %s", async (_case, body, message) => {
    const response = await post(body);

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ message });
    expect(User.create).not.toHaveBeenCalled();
  });

  it("responds 422 with field errors when the email and password are invalid", async () => {
    const response = await post({
      ...validBody,
      email: "invalid@",
      password: "short",
    });

    expect(response.status).toBe(422);
    expect(response.body).toEqual({
      errors: {
        email: "Invalid email",
        password: "Password must be at least 8 characters long",
      },
    });
    expect(User.create).not.toHaveBeenCalled();
  });

  it("responds 422 when the role does not exist in the roles table", async () => {
    Role.findOne.mockResolvedValue(null);

    const response = await post({ ...validBody, role: "superadmin" });

    expect(response.status).toBe(422);
    expect(response.body).toEqual({ errors: { role: "Invalid role" } });
    expect(User.create).not.toHaveBeenCalled();
  });

  it("responds 409 when the username or email already exists", async () => {
    Role.findOne.mockResolvedValue(SELLER_ROLE);
    User.create.mockRejectedValue(new UniqueConstraintError({}));

    const response = await post(validBody);

    expect(response.status).toBe(409);
    expect(response.body).toEqual({ message: "User already exists" });
  });

  it("forwards unexpected persistence errors", async () => {
    Role.findOne.mockResolvedValue(SELLER_ROLE);
    User.create.mockRejectedValue(new Error("database exploded"));

    const response = await post(validBody);

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ message: "Server error" });
  });
});
