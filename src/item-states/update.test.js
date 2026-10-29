process.env.JWT_SECRET = "test-secret";

jest.mock("../models/item-state", () => ({
  create: jest.fn(),
  findAll: jest.fn(),
  findByPk: jest.fn(),
}));
jest.mock("../models/cost", () => ({ findOne: jest.fn() }));
jest.mock("../models/user", () => ({ findByPk: jest.fn() }));

const express = require("express");
const request = require("supertest");
const jwt = require("jsonwebtoken");
const { UniqueConstraintError } = require("sequelize");
const ItemState = require("../models/item-state");
const User = require("../models/user");
const { itemStateRepository } = require("./repository");
const updateRouter = require("./update");

const app = express();
app.use(express.json());
app.use("/item-states", updateRouter);
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
 * Builds a stored item state double with a working update method.
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
    update: jest.fn(function update(values) {
      Object.assign(this, values);
      return Promise.resolve(this);
    }),
    ...overrides,
  };
}

/**
 * Sends a PUT /item-states/:id request.
 * @param {string} id - Route parameter.
 * @param {object} body - Request body.
 * @param {string|null} [token] - Bearer token, null to omit the header.
 * @returns {Promise<import("supertest").Response>} HTTP response.
 */
function put(id, body, token = tokenFor()) {
  const req = request(app).put(`/item-states/${id}`);

  return token
    ? req.set("Authorization", `Bearer ${token}`).send(body)
    : req.send(body);
}

beforeEach(() => {
  ItemState.findByPk.mockReset();
  User.findByPk.mockReset();
  User.findByPk.mockResolvedValue(AUTH_USER);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe("PUT /item-states/:id", () => {
  it.each(["admin", "seller"])(
    "allows a %s to update every field and answers 202",
    async (role) => {
      const itemState = target();
      ItemState.findByPk.mockResolvedValue(itemState);

      const response = await put(
        "1",
        {
          name: "returned",
          label: "Devuelto",
          description: "Devuelto por el cliente",
          is_sellable: false,
        },
        tokenFor(role),
      );

      expect(response.status).toBe(202);
      expect(response.body).toEqual({
        id: 1,
        name: "returned",
        label: "Devuelto",
        description: "Devuelto por el cliente",
        is_sellable: false,
      });
      expect(itemState.update).toHaveBeenCalledWith({
        name: "returned",
        label: "Devuelto",
        description: "Devuelto por el cliente",
        is_sellable: false,
      });
      expect(response.body).not.toHaveProperty("createdAt");
      expect(response.body).not.toHaveProperty("updatedAt");
    },
  );

  it("updates only is_sellable when the other fields are omitted", async () => {
    const itemState = target();
    ItemState.findByPk.mockResolvedValue(itemState);

    const response = await put("1", { is_sellable: false });

    expect(response.status).toBe(202);
    expect(itemState.update).toHaveBeenCalledWith({ is_sellable: false });
  });

  it("clears the description with null", async () => {
    const itemState = target({ description: "Temporal" });
    ItemState.findByPk.mockResolvedValue(itemState);

    const response = await put("1", { description: null });

    expect(response.status).toBe(202);
    expect(itemState.update).toHaveBeenCalledWith({ description: null });
    expect(response.body.description).toBeNull();
  });

  it("drops unknown and audit fields", async () => {
    const itemState = target();
    ItemState.findByPk.mockResolvedValue(itemState);

    const response = await put("1", {
      label: "Vendible",
      id: 99,
      createdAt: "2026-09-01",
      updatedAt: "2026-09-01",
      admin: true,
    });

    expect(response.status).toBe(202);
    expect(itemState.update).toHaveBeenCalledWith({ label: "Vendible" });
  });

  it("allows renaming when the item state is not referenced", async () => {
    const itemState = target();
    ItemState.findByPk.mockResolvedValue(itemState);
    jest
      .spyOn(itemStateRepository, "isReferenced")
      .mockResolvedValueOnce(false);

    const response = await put("1", { name: "available" });

    expect(response.status).toBe(202);
    expect(itemState.update).toHaveBeenCalledWith({ name: "available" });
  });

  it("responds 409 and keeps the name when the item state is referenced", async () => {
    const itemState = target();
    ItemState.findByPk.mockResolvedValue(itemState);
    jest.spyOn(itemStateRepository, "isReferenced").mockResolvedValueOnce(true);

    const response = await put("1", { name: "available" });

    expect(response.status).toBe(409);
    expect(response.body).toEqual({ message: "Item state is in use" });
    expect(itemState.update).not.toHaveBeenCalled();
  });

  it("updates other fields of a referenced item state without renaming it", async () => {
    const itemState = target();
    ItemState.findByPk.mockResolvedValue(itemState);
    const spy = jest
      .spyOn(itemStateRepository, "isReferenced")
      .mockResolvedValue(true);

    const response = await put("1", { name: "sellable", label: "Disponible" });

    expect(response.status).toBe(202);
    expect(spy).not.toHaveBeenCalled();
    expect(itemState.update).toHaveBeenCalledWith({
      name: "sellable",
      label: "Disponible",
    });
  });

  it("responds 409 when the new name belongs to another item state", async () => {
    const itemState = target();
    itemState.update.mockRejectedValue(
      new UniqueConstraintError({ message: "duplicate" }),
    );
    ItemState.findByPk.mockResolvedValue(itemState);

    const response = await put("1", { name: "damaged" });

    expect(response.status).toBe(409);
    expect(response.body).toEqual({ message: "Item state already exists" });
  });
  it("responds 404 when the item state does not exist", async () => {
    ItemState.findByPk.mockResolvedValue(null);

    const response = await put("999", { label: "Vendible" });

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ message: "Item state not found" });
  });

  it.each(["abc", "0", "-1", "1.5"])(
    "responds 422 when the id is %s",
    async (id) => {
      const response = await put(id, { label: "Vendible" });

      expect(response.status).toBe(422);
      expect(response.body).toEqual({
        errors: { id: "Invalid item state id" },
      });
      expect(ItemState.findByPk).not.toHaveBeenCalled();
    },
  );

  it("responds 400 when no field is provided", async () => {
    const response = await put("1", {});

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      message: "at least one field is required",
    });
    expect(ItemState.findByPk).not.toHaveBeenCalled();
  });

  it.each([
    [{ name: "Sellable" }, { name: "name must be snake_case" }],
    [{ name: "   " }, { name: "name must be snake_case" }],
    [{ label: "V" }, { label: "label is invalid" }],
    [{ label: null }, { label: "label is invalid" }],
    [{ is_sellable: "true" }, { is_sellable: "is_sellable must be a boolean" }],
  ])(
    "responds 422 when a provided field is invalid in %p",
    async (body, errors) => {
      const response = await put("1", body);

      expect(response.status).toBe(422);
      expect(response.body).toEqual({ errors });
      expect(ItemState.findByPk).not.toHaveBeenCalled();
    },
  );

  it("responds 401 when the token is missing", async () => {
    const response = await put("1", { label: "Vendible" }, null);

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ message: "Unauthorized" });
    expect(ItemState.findByPk).not.toHaveBeenCalled();
  });

  it.each(["dispatcher", "manager_warehouse", "support", "customer"])(
    "responds 403 when the authenticated user is %s",
    async (role) => {
      const response = await put("1", { label: "Vendible" }, tokenFor(role));

      expect(response.status).toBe(403);
      expect(response.body).toEqual({ message: "Forbidden" });
      expect(ItemState.findByPk).not.toHaveBeenCalled();
    },
  );

  it("responds 403 when the authenticated user is blocked", async () => {
    User.findByPk.mockResolvedValue({ ...AUTH_USER, isBlocked: true });

    const response = await put("1", { label: "Vendible" });

    expect(response.status).toBe(403);
    expect(response.body).toEqual({ message: "User is blocked" });
  });
  it("forwards unexpected persistence errors", async () => {
    const itemState = target();
    itemState.update.mockRejectedValue(new Error("database exploded"));
    ItemState.findByPk.mockResolvedValue(itemState);

    const response = await put("1", { label: "Vendible" });

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ message: "Server error" });
  });
});
