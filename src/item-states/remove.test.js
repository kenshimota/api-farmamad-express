process.env.JWT_SECRET = "test-secret";

jest.mock("../models/item-state", () => ({
  create: jest.fn(),
  findAll: jest.fn(),
  findByPk: jest.fn(),
}));
jest.mock("../models/user", () => ({ findByPk: jest.fn() }));

const express = require("express");
const request = require("supertest");
const jwt = require("jsonwebtoken");
const { ForeignKeyConstraintError } = require("sequelize");
const ItemState = require("../models/item-state");
const User = require("../models/user");
const { itemStateRepository } = require("./repository");
const removeRouter = require("./remove");

const app = express();
app.use(express.json());
app.use("/item-states", removeRouter);
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
 * Builds a stored item state double with a working destroy method.
 * @param {object} [overrides] - Attribute overrides.
 * @returns {object} The item state double.
 */
function target(overrides = {}) {
  return {
    id: 1,
    name: "sellable",
    label: "Vendible",
    description: null,
    is_sellable: true,
    destroy: jest.fn().mockResolvedValue(),
    ...overrides,
  };
}

/**
 * Sends a DELETE /item-states/:id request.
 * @param {string} id - Route parameter.
 * @param {string|null} [token] - Bearer token, null to omit the header.
 * @returns {Promise<import("supertest").Response>} HTTP response.
 */
function remove(id, token = tokenFor()) {
  const req = request(app).delete(`/item-states/${id}`);

  return token ? req.set("Authorization", `Bearer ${token}`) : req;
}

beforeEach(() => {
  ItemState.findByPk.mockReset();
  User.findByPk.mockReset();
  User.findByPk.mockResolvedValue(AUTH_USER);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe("DELETE /item-states/:id", () => {
  it.each(["admin", "seller"])(
    "allows a %s to delete an item state and answers 204",
    async (role) => {
      const itemState = target();
      ItemState.findByPk.mockResolvedValue(itemState);

      const response = await remove("1", tokenFor(role));

      expect(response.status).toBe(204);
      expect(response.text).toBe("");
      expect(itemState.destroy).toHaveBeenCalledTimes(1);
    },
  );

  it("responds 409 without deleting when the repository reports a reference", async () => {
    const itemState = target();
    ItemState.findByPk.mockResolvedValue(itemState);
    jest.spyOn(itemStateRepository, "isReferenced").mockResolvedValueOnce(true);

    const response = await remove("1");

    expect(response.status).toBe(409);
    expect(response.body).toEqual({ message: "Item state is in use" });
    expect(itemState.destroy).not.toHaveBeenCalled();
  });

  it("responds 409 when a foreign key keeps the item state in use", async () => {
    const itemState = target();
    itemState.destroy.mockRejectedValue(
      new ForeignKeyConstraintError({ message: "foreign key" }),
    );
    ItemState.findByPk.mockResolvedValue(itemState);

    const response = await remove("1");

    expect(response.status).toBe(409);
    expect(response.body).toEqual({ message: "Item state is in use" });
  });

  it("responds 404 when the item state does not exist", async () => {
    ItemState.findByPk.mockResolvedValue(null);

    const response = await remove("999");

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ message: "Item state not found" });
  });

  it.each(["abc", "0", "-1", "1.5"])(
    "responds 422 when the id is %s",
    async (id) => {
      const response = await remove(id);

      expect(response.status).toBe(422);
      expect(response.body).toEqual({
        errors: { id: "Invalid item state id" },
      });
      expect(ItemState.findByPk).not.toHaveBeenCalled();
    },
  );

  it("responds 401 when the token is missing", async () => {
    const response = await remove("1", null);

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ message: "Unauthorized" });
    expect(ItemState.findByPk).not.toHaveBeenCalled();
  });

  it.each(["dispatcher", "manager_warehouse", "support", "customer"])(
    "responds 403 when the authenticated user is %s",
    async (role) => {
      const response = await remove("1", tokenFor(role));

      expect(response.status).toBe(403);
      expect(response.body).toEqual({ message: "Forbidden" });
      expect(ItemState.findByPk).not.toHaveBeenCalled();
    },
  );

  it("responds 403 when the authenticated user is blocked", async () => {
    User.findByPk.mockResolvedValue({ ...AUTH_USER, isBlocked: true });

    const response = await remove("1");

    expect(response.status).toBe(403);
    expect(response.body).toEqual({ message: "User is blocked" });
  });

  it("forwards unexpected persistence errors", async () => {
    const itemState = target();
    itemState.destroy.mockRejectedValue(new Error("database exploded"));
    ItemState.findByPk.mockResolvedValue(itemState);

    const response = await remove("1");

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ message: "Server error" });
  });
});
