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
const Role = require("../models/role");
const sequelize = require("../database");
const removeRouter = require("./remove");

const app = express();
app.use(express.json());
app.use("/users", removeRouter);

const SECRET = "test-secret";
const TRANSACTION = { LOCK: { UPDATE: "UPDATE" } };
const AUTH_USER = {
  id: 1,
  username: "admin",
  isBlocked: false,
  roleId: 1,
  role: { name: "admin" },
  setDataValue: jest.fn(function setDataValue(key, value) {
    this[key] = value;
  }),
};

/**
 * Builds a JWT for the given role and subject.
 * @param {string} [role] - Role name to embed in the token.
 * @param {number} [sub] - User id to embed in the token.
 * @returns {string} Signed JWT.
 */
function tokenFor(role = "admin", sub = 1) {
  return jwt.sign({ sub, username: "admin", role }, SECRET, {
    expiresIn: "1h",
  });
}

/**
 * Builds a target user double with a working destroy method.
 * @param {object} [overrides] - Attribute overrides.
 * @returns {object} The user double.
 */
function target(overrides = {}) {
  return {
    id: 2,
    username: "maria",
    email: "maria@superking.com",
    name: "María",
    isBlocked: false,
    roleId: 2,
    role: { name: "seller" },
    setDataValue: jest.fn(function setDataValue(key, value) {
      this[key] = value;
    }),
    destroy: jest.fn(),
    ...overrides,
  };
}

/**
 * Makes the authentication lookup return the admin and the handler lookup
 * return the provided target.
 * @param {object|null} user - Target user returned for ids other than 1.
 * @returns {void}
 */
function mockLookup(user) {
  User.findByPk.mockImplementation((id) =>
    Promise.resolve(Number(id) === AUTH_USER.id ? AUTH_USER : user),
  );
  Role.findByPk.mockImplementation((id) =>
    Promise.resolve(user && user.role ? { id, ...user.role } : null),
  );
}

const removeUser = (id, token = tokenFor()) => {
  const req = request(app).delete(`/users/${id}`);

  return token ? req.set("Authorization", `Bearer ${token}`) : req;
};

beforeEach(() => {
  User.findByPk.mockReset();
  User.count.mockReset();
  Role.findByPk.mockReset();
  sequelize.transaction.mockReset();
  sequelize.transaction.mockImplementation((callback) => callback(TRANSACTION));
  mockLookup(target());
});

describe("DELETE /users/:id", () => {
  it("deletes the user and responds 204 without a body", async () => {
    const user = target();
    mockLookup(user);

    const response = await removeUser(2);

    expect(response.status).toBe(204);
    expect(response.body).toEqual({});
    expect(response.text).toBe("");
    expect(user.destroy).toHaveBeenCalledWith({ transaction: TRANSACTION });
    expect(User.findByPk).toHaveBeenCalledWith(2, {
      transaction: TRANSACTION,
      lock: TRANSACTION.LOCK.UPDATE,
    });
    expect(Role.findByPk).toHaveBeenCalledWith(2, {
      transaction: TRANSACTION,
    });
  });

  it("responds 422 when the id is not a positive integer", async () => {
    const response = await removeUser("abc");

    expect(response.status).toBe(422);
    expect(response.body).toEqual({ errors: { id: "Invalid user id" } });
    expect(User.findByPk).toHaveBeenCalledTimes(1);
  });

  it("responds 404 when the user does not exist", async () => {
    mockLookup(null);

    const response = await removeUser(999);

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ message: "User not found" });
  });

  it("responds 409 when the administrator tries to delete itself", async () => {
    const response = await removeUser(1);

    expect(response.status).toBe(409);
    expect(response.body).toEqual({
      message: "You cannot delete your own account",
    });
  });

  it("responds 409 when deleting the last active administrator", async () => {
    const admin = target({
      id: 3,
      username: "ana",
      email: "ana@superking.com",
      name: "Ana",
      roleId: 1,
      role: { name: "admin" },
    });
    mockLookup(admin);
    User.count.mockResolvedValue(1);

    const response = await removeUser(3);

    expect(response.status).toBe(409);
    expect(response.body).toEqual({
      message: "Cannot delete the last administrator",
    });
    expect(User.count).toHaveBeenCalledWith({
      where: { roleId: 1, isBlocked: false },
      transaction: TRANSACTION,
    });
    expect(admin.destroy).not.toHaveBeenCalled();
  });

  it("does not count administrators when the target is not an admin", async () => {
    const response = await removeUser(2);

    expect(response.status).toBe(204);
    expect(User.count).not.toHaveBeenCalled();
  });

  it("responds 401 when the token is missing", async () => {
    const response = await removeUser(2, null);

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ message: "Unauthorized" });
  });

  it("responds 401 when the token is invalid", async () => {
    const response = await removeUser(2, "not-a-jwt");

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ message: "Unauthorized" });
  });

  it.each(["seller", "delivery", "freelance_delivery", "customer"])(
    "responds 403 when the authenticated user is %s",
    async (role) => {
      const response = await removeUser(2, tokenFor(role));

      expect(response.status).toBe(403);
      expect(response.body).toEqual({ message: "Forbidden" });
    },
  );

  it("responds 403 when the authenticated administrator is blocked", async () => {
    User.findByPk.mockResolvedValue({ ...AUTH_USER, isBlocked: true });

    const response = await removeUser(2);

    expect(response.status).toBe(403);
    expect(response.body).toEqual({ message: "User is blocked" });
  });
});
