process.env.JWT_SECRET = "test-secret";

jest.mock("../models/category", () => ({
  create: jest.fn(),
  findAll: jest.fn(),
  findByPk: jest.fn(),
}));
jest.mock("../models/user", () => ({ findByPk: jest.fn() }));

const express = require("express");
const request = require("supertest");
const jwt = require("jsonwebtoken");
const { UniqueConstraintError } = require("sequelize");
const Category = require("../models/category");
const User = require("../models/user");
const updateRouter = require("./update");

const app = express();
app.use(express.json());
app.use("/categories", updateRouter);
app.use((error, req, res, next) => {
  res.status(500).json({ message: "Server error" });
});

const SECRET = "test-secret";
const AUTH_USER = { id: 1, username: "admin", isBlocked: false };
const validBody = { name: "Antiinflamatorios" };

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
 * Builds a stored category double with a working update method.
 * @param {object} [overrides] - Attribute overrides.
 * @returns {object} The category double.
 */
function target(overrides = {}) {
  return {
    id: 1,
    name: "Analgésicos",
    createdAt: new Date("2026-09-01T00:00:00.000Z"),
    updatedAt: new Date("2026-09-01T00:00:00.000Z"),
    update: jest.fn(function update(values) {
      Object.assign(this, values);
      return Promise.resolve(this);
    }),
    ...overrides,
  };
}

/**
 * Sends a PUT /categories/:id request.
 * @param {string} id - Route parameter.
 * @param {object} body - Request body.
 * @param {string|null} [token] - Bearer token, null to omit the header.
 * @returns {Promise<import("supertest").Response>} HTTP response.
 */
function put(id, body, token = tokenFor()) {
  const req = request(app).put(`/categories/${id}`);

  return token
    ? req.set("Authorization", `Bearer ${token}`).send(body)
    : req.send(body);
}

beforeEach(() => {
  Category.findByPk.mockReset();
  User.findByPk.mockReset();
  User.findByPk.mockResolvedValue(AUTH_USER);
});

describe("PUT /categories/:id", () => {
  it.each(["admin", "seller"])(
    "allows a %s to update the category and answers 202",
    async (role) => {
      const category = target();
      Category.findByPk.mockResolvedValue(category);

      const response = await put("1", validBody, tokenFor(role));

      expect(response.status).toBe(202);
      expect(response.body).toEqual({ id: 1, name: "Antiinflamatorios" });
      expect(category.update).toHaveBeenCalledWith(validBody);
      expect(response.body).not.toHaveProperty("createdAt");
      expect(response.body).not.toHaveProperty("updatedAt");
    },
  );

  it("trims the name before persisting it", async () => {
    const category = target();
    Category.findByPk.mockResolvedValue(category);

    const response = await put("1", { name: "  Antiinflamatorios  " });

    expect(response.status).toBe(202);
    expect(category.update).toHaveBeenCalledWith(validBody);
  });

  it("drops unknown and audit fields", async () => {
    const category = target();
    Category.findByPk.mockResolvedValue(category);

    const response = await put("1", {
      ...validBody,
      id: 99,
      createdAt: "2026-09-01",
      updatedAt: "2026-09-01",
      admin: true,
    });

    expect(response.status).toBe(202);
    expect(category.update).toHaveBeenCalledWith(validBody);
  });

  it("responds 409 when the name belongs to another category", async () => {
    const category = target();
    category.update.mockRejectedValue(
      new UniqueConstraintError({ message: "duplicate" }),
    );
    Category.findByPk.mockResolvedValue(category);

    const response = await put("1", validBody);

    expect(response.status).toBe(409);
    expect(response.body).toEqual({ message: "Category already exists" });
  });

  it("responds 404 when the category does not exist", async () => {
    Category.findByPk.mockResolvedValue(null);

    const response = await put("999", validBody);

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ message: "Category not found" });
  });

  it.each(["abc", "0", "-1", "1.5"])(
    "responds 422 when the id is %s",
    async (id) => {
      const response = await put(id, validBody);

      expect(response.status).toBe(422);
      expect(response.body).toEqual({
        errors: { id: "Invalid category id" },
      });
      expect(Category.findByPk).not.toHaveBeenCalled();
    },
  );

  it.each([{}, { name: "" }, { name: null }])(
    "responds 400 when name is missing in %p",
    async (body) => {
      const response = await put("1", body);

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ message: "name is required" });
      expect(Category.findByPk).not.toHaveBeenCalled();
    },
  );

  it("responds 422 when the name is invalid", async () => {
    const response = await put("1", { name: "   " });

    expect(response.status).toBe(422);
    expect(response.body).toEqual({
      errors: { name: "Nombre inválido" },
    });
    expect(Category.findByPk).not.toHaveBeenCalled();
  });

  it("responds 401 when the token is missing", async () => {
    const response = await put("1", validBody, null);

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ message: "Unauthorized" });
    expect(Category.findByPk).not.toHaveBeenCalled();
  });

  it.each(["dispatcher", "manager_warehouse", "support", "customer"])(
    "responds 403 when the authenticated user is %s",
    async (role) => {
      const response = await put("1", validBody, tokenFor(role));

      expect(response.status).toBe(403);
      expect(response.body).toEqual({ message: "Forbidden" });
      expect(Category.findByPk).not.toHaveBeenCalled();
    },
  );

  it("responds 403 when the authenticated user is blocked", async () => {
    User.findByPk.mockResolvedValue({ ...AUTH_USER, isBlocked: true });

    const response = await put("1", validBody);

    expect(response.status).toBe(403);
    expect(response.body).toEqual({ message: "User is blocked" });
  });

  it("forwards unexpected persistence errors", async () => {
    const category = target();
    category.update.mockRejectedValue(new Error("database exploded"));
    Category.findByPk.mockResolvedValue(category);

    const response = await put("1", validBody);

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ message: "Server error" });
  });
});
