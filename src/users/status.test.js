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
const statusRouter = require("./status");

const app = express();
app.use(express.json());
app.use("/users", statusRouter);

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
  update: jest.fn(function update(values) {
    Object.assign(this, values);
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
 * Builds a target user double with a working update method.
 * @param {object} [overrides] - Attribute overrides.
 * @returns {object} The user double.
 */
function target(overrides = {}) {
  return {
    id: 2,
    username: "maria",
    email: "maria@breadking.com",
    name: "María",
    isBlocked: false,
    roleId: 2,
    role: { name: "seller" },
    setDataValue: jest.fn(function setDataValue(key, value) {
      this[key] = value;
    }),
    update: jest.fn(function update(values) {
      Object.assign(this, values);
    }),
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

const patchStatus = (id, body, token = tokenFor()) => {
  const req = request(app).patch(`/users/${id}/status`);

  return token
    ? req.set("Authorization", `Bearer ${token}`).send(body)
    : req.send(body);
};

beforeEach(() => {
  User.findByPk.mockReset();
  User.count.mockReset();
  Role.findByPk.mockReset();
  sequelize.transaction.mockReset();
  sequelize.transaction.mockImplementation((callback) => callback(TRANSACTION));
  mockLookup(target());
});

describe("PATCH /users/:id/status", () => {
  it("blocks a user and returns the updated public data", async () => {
    const user = target();
    mockLookup(user);

    const response = await patchStatus(2, { isBlocked: true });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      id: 2,
      username: "maria",
      email: "maria@breadking.com",
      name: "María",
      role: "seller",
      isBlocked: true,
    });
    expect(response.body).not.toHaveProperty("password");
    expect(response.body).not.toHaveProperty("roleId");
    expect(user.update).toHaveBeenCalledWith(
      { isBlocked: true },
      { transaction: TRANSACTION },
    );
    expect(User.findByPk).toHaveBeenCalledWith(2, {
      transaction: TRANSACTION,
      lock: TRANSACTION.LOCK.UPDATE,
    });
    expect(Role.findByPk).toHaveBeenCalledWith(2, {
      transaction: TRANSACTION,
    });
  });

  it("unblocks a user", async () => {
    const user = target({ isBlocked: true });
    mockLookup(user);

    const response = await patchStatus(2, { isBlocked: false });

    expect(response.status).toBe(200);
    expect(response.body.isBlocked).toBe(false);
    expect(user.update).toHaveBeenCalledWith(
      { isBlocked: false },
      { transaction: TRANSACTION },
    );
  });

  it("responds 422 when the id is not a positive integer", async () => {
    const response = await patchStatus("abc", { isBlocked: true });

    expect(response.status).toBe(422);
    expect(response.body).toEqual({ errors: { id: "Invalid user id" } });
    expect(User.findByPk).toHaveBeenCalledTimes(1);
  });

  it("responds 400 when isBlocked is missing", async () => {
    const response = await patchStatus(2, {});

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ message: "isBlocked is required" });
    expect(User.findByPk).toHaveBeenCalledTimes(1);
  });

  it.each([["true"], [1], [0], [{}]])(
    "responds 422 when isBlocked is %p",
    async (value) => {
      const response = await patchStatus(2, { isBlocked: value });

      expect(response.status).toBe(422);
      expect(response.body).toEqual({
        errors: { isBlocked: "isBlocked must be a boolean" },
      });
    },
  );

  it("responds 404 when the user does not exist", async () => {
    mockLookup(null);

    const response = await patchStatus(999, { isBlocked: true });

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ message: "User not found" });
  });

  it("responds 409 when the administrator tries to block itself", async () => {
    const response = await patchStatus(1, { isBlocked: true });

    expect(response.status).toBe(409);
    expect(response.body).toEqual({
      message: "You cannot block your own account",
    });
  });

  it("responds 409 when blocking the last active administrator", async () => {
    const admin = target({
      id: 3,
      username: "ana",
      email: "ana@breadking.com",
      name: "Ana",
      roleId: 1,
      role: { name: "admin" },
    });
    mockLookup(admin);
    User.count.mockResolvedValue(1);

    const response = await patchStatus(3, { isBlocked: true });

    expect(response.status).toBe(409);
    expect(response.body).toEqual({
      message: "Cannot block the last administrator",
    });
    expect(User.count).toHaveBeenCalledWith({
      where: { roleId: 1, isBlocked: false },
      transaction: TRANSACTION,
    });
    expect(admin.update).not.toHaveBeenCalled();
  });

  it("does not count administrators when the target is not an admin", async () => {
    const response = await patchStatus(2, { isBlocked: true });

    expect(response.status).toBe(200);
    expect(User.count).not.toHaveBeenCalled();
  });

  it("blocks an already blocked administrator without the last admin guard", async () => {
    const admin = target({
      id: 3,
      username: "ana",
      email: "ana@breadking.com",
      name: "Ana",
      roleId: 1,
      role: { name: "admin" },
      isBlocked: true,
    });
    mockLookup(admin);
    User.count.mockResolvedValue(1);

    const response = await patchStatus(3, { isBlocked: true });

    expect(response.status).toBe(200);
    expect(response.body.isBlocked).toBe(true);
  });

  it("does not apply the last admin guard when unblocking", async () => {
    const admin = target({
      id: 3,
      username: "ana",
      email: "ana@breadking.com",
      name: "Ana",
      roleId: 1,
      role: { name: "admin" },
    });
    mockLookup(admin);
    User.count.mockResolvedValue(1);

    const response = await patchStatus(3, { isBlocked: false });

    expect(response.status).toBe(200);
    expect(response.body.isBlocked).toBe(false);
    expect(User.count).not.toHaveBeenCalled();
  });

  it("allows unblocking your own account without the self block guard", async () => {
    mockLookup(AUTH_USER);
    User.count.mockResolvedValue(2);

    const response = await patchStatus(1, { isBlocked: false });

    expect(response.status).toBe(200);
    expect(response.body.isBlocked).toBe(false);
  });
});
