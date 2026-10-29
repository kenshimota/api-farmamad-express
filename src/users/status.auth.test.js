process.env.JWT_SECRET = "test-secret";

jest.mock("../models/user", () => ({
  findByPk: jest.fn(),
  count: jest.fn(),
}));
jest.mock("../models/role", () => ({
  findOne: jest.fn(),
  findByPk: jest.fn(),
}));
jest.mock("../database", () => ({ transaction: jest.fn() }));

const express = require("express");
const request = require("supertest");
const jwt = require("jsonwebtoken");
const User = require("../models/user");
const statusRouter = require("./status");

const app = express();
app.use(express.json());
app.use("/users", statusRouter);

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

const patchStatus = (id, body, token = tokenFor()) => {
  const req = request(app).patch(`/users/${id}/status`);

  return token
    ? req.set("Authorization", `Bearer ${token}`).send(body)
    : req.send(body);
};

beforeEach(() => {
  User.findByPk.mockReset();
  User.count.mockReset();
  User.findByPk.mockResolvedValue(AUTH_USER);
});

describe("PATCH /users/:id/status authentication", () => {
  it("responds 401 when the token is missing", async () => {
    const response = await patchStatus(2, { isBlocked: true }, null);

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ message: "Unauthorized" });
  });

  it("responds 401 when the token is invalid", async () => {
    const response = await patchStatus(2, { isBlocked: true }, "not-a-jwt");

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ message: "Unauthorized" });
  });

  it.each(["seller", "dispatcher", "manager_warehouse", "support", "customer"])(
    "responds 403 when the authenticated user is %s",
    async (role) => {
      const response = await patchStatus(
        2,
        { isBlocked: true },
        tokenFor(role),
      );

      expect(response.status).toBe(403);
      expect(response.body).toEqual({ message: "Forbidden" });
    },
  );

  it("responds 403 when the authenticated administrator is blocked", async () => {
    User.findByPk.mockResolvedValue({ ...AUTH_USER, isBlocked: true });

    const response = await patchStatus(2, { isBlocked: true });

    expect(response.status).toBe(403);
    expect(response.body).toEqual({ message: "User is blocked" });
  });
});
