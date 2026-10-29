process.env.JWT_SECRET = "test-secret";

jest.mock("../models/supplier", () => ({
  create: jest.fn(),
  findAll: jest.fn(),
  findByPk: jest.fn(),
}));
jest.mock("../models/city", () => ({ findByPk: jest.fn() }));
jest.mock("../models/state", () => ({ findByPk: jest.fn() }));
jest.mock("../models/purchase", () => ({ findOne: jest.fn() }));
jest.mock("../models/user", () => ({ findByPk: jest.fn() }));

const express = require("express");
const request = require("supertest");
const jwt = require("jsonwebtoken");
const { ForeignKeyConstraintError } = require("sequelize");
const Supplier = require("../models/supplier");
const User = require("../models/user");
const removeRouter = require("./remove");
const { supplierRepository } = require("./repository");

const app = express();
app.use(express.json());
app.use("/suppliers", removeRouter);
app.use((error, req, res, next) => {
  res.status(500).json({ message: "Server error" });
});

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

/**
 * Builds a stored supplier double with a working destroy method.
 * @param {object} [overrides] - Attribute overrides.
 * @returns {object} The supplier double.
 */
function target(overrides = {}) {
  return {
    id: 1,
    city_id: 10,
    state_id: 4,
    destroy: jest.fn().mockResolvedValue(),
    ...overrides,
  };
}

/**
 * Sends a DELETE /suppliers/:id request.
 * @param {string} id - Route parameter.
 * @param {string|null} [token] - Bearer token, null to omit the header.
 * @returns {Promise<import("supertest").Response>} HTTP response.
 */
function remove(id, token = tokenFor()) {
  const req = request(app).delete(`/suppliers/${id}`);

  return token ? req.set("Authorization", `Bearer ${token}`) : req;
}

beforeEach(() => {
  Supplier.findByPk.mockReset();
  User.findByPk.mockReset();
  User.findByPk.mockResolvedValue(AUTH_USER);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe("DELETE /suppliers/:id", () => {
  it.each(["admin", "seller"])(
    "allows a %s to delete a supplier and answers 204",
    async (role) => {
      const supplier = target();
      Supplier.findByPk.mockResolvedValue(supplier);

      const response = await remove("1", tokenFor(role));

      expect(response.status).toBe(204);
      expect(response.text).toBe("");
      expect(supplier.destroy).toHaveBeenCalledTimes(1);
    },
  );

  it("responds 409 when a foreign key keeps the supplier in use", async () => {
    const supplier = target();
    supplier.destroy.mockRejectedValue(
      new ForeignKeyConstraintError({ message: "foreign key" }),
    );
    Supplier.findByPk.mockResolvedValue(supplier);

    const response = await remove("1");

    expect(response.status).toBe(409);
    expect(response.body).toEqual({ message: "Supplier is in use" });
  });

  it("responds 409 when the supplier has purchases", async () => {
    const supplier = target();
    Supplier.findByPk.mockResolvedValue(supplier);
    jest.spyOn(supplierRepository, "hasPurchases").mockResolvedValueOnce(true);

    const response = await remove("1");

    expect(response.status).toBe(409);
    expect(response.body).toEqual({ message: "Supplier is in use" });
    expect(supplierRepository.hasPurchases).toHaveBeenCalledWith(1);
    expect(supplier.destroy).not.toHaveBeenCalled();
  });

  it("responds 404 when the supplier does not exist", async () => {
    Supplier.findByPk.mockResolvedValue(null);

    const response = await remove("999");

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ message: "Supplier not found" });
  });

  it.each(["abc", "0", "-1", "1.5"])(
    "responds 422 when the id is %s",
    async (id) => {
      const response = await remove(id);

      expect(response.status).toBe(422);
      expect(response.body).toEqual({
        errors: { id: "Invalid supplier id" },
      });
      expect(Supplier.findByPk).not.toHaveBeenCalled();
    },
  );

  it("responds 401 when the token is missing", async () => {
    const response = await remove("1", null);

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ message: "Unauthorized" });
    expect(Supplier.findByPk).not.toHaveBeenCalled();
  });

  it.each(["dispatcher", "manager_warehouse", "support", "customer"])(
    "responds 403 when the authenticated user is %s",
    async (role) => {
      const response = await remove("1", tokenFor(role));

      expect(response.status).toBe(403);
      expect(response.body).toEqual({ message: "Forbidden" });
      expect(Supplier.findByPk).not.toHaveBeenCalled();
    },
  );

  it("responds 403 when the authenticated user is blocked", async () => {
    User.findByPk.mockResolvedValue({ ...AUTH_USER, isBlocked: true });

    const response = await remove("1");

    expect(response.status).toBe(403);
    expect(response.body).toEqual({ message: "User is blocked" });
  });

  it("forwards unexpected persistence errors", async () => {
    const supplier = target();
    supplier.destroy.mockRejectedValue(new Error("database exploded"));
    Supplier.findByPk.mockResolvedValue(supplier);

    const response = await remove("1");

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ message: "Server error" });
  });
});
