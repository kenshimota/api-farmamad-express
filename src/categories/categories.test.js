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
const categoriesRouter = require("./index");

const app = express();
app.use(express.json());
app.use("/categories", categoriesRouter);
app.use((error, req, res, next) => {
  res.status(500).json({ message: "Server error" });
});

const SECRET = "test-secret";
const AUTH_USER = { id: 1, username: "admin", isBlocked: false };
const validBody = { name: "Analgésicos" };

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
 * Builds a stored category double as returned by Sequelize.
 * @param {object} [overrides] - Attribute overrides.
 * @returns {object} The category double.
 */
function storedCategory(overrides = {}) {
  return {
    id: 1,
    name: "Analgésicos",
    createdAt: new Date("2026-09-01T00:00:00.000Z"),
    updatedAt: new Date("2026-09-01T00:00:00.000Z"),
    ...overrides,
  };
}

/**
 * Sends a POST /categories request.
 * @param {object} body - Request body.
 * @param {string|null} [token] - Bearer token, null to omit the header.
 * @returns {Promise<import("supertest").Response>} HTTP response.
 */
function post(body, token = tokenFor()) {
  const req = request(app).post("/categories");

  return token
    ? req.set("Authorization", `Bearer ${token}`).send(body)
    : req.send(body);
}

beforeEach(() => {
  Category.create.mockReset();
  Category.findAll.mockReset();
  Category.findByPk.mockReset();
  User.findByPk.mockReset();
  User.findByPk.mockResolvedValue(AUTH_USER);
});

describe("POST /categories", () => {
  it.each(["admin", "seller"])(
    "allows a %s to create a category and answers 201",
    async (role) => {
      Category.create.mockResolvedValue(storedCategory());

      const response = await post(validBody, tokenFor(role));

      expect(response.status).toBe(201);
      expect(response.body).toEqual({ id: 1, name: "Analgésicos" });
      expect(response.body).not.toHaveProperty("createdAt");
      expect(response.body).not.toHaveProperty("updatedAt");
      expect(Category.create).toHaveBeenCalledWith(validBody);
    },
  );

  it("trims the name before persisting it", async () => {
    Category.create.mockResolvedValue(storedCategory());

    const response = await post({ name: "  Analgésicos  " });

    expect(response.status).toBe(201);
    expect(Category.create).toHaveBeenCalledWith(validBody);
    expect(response.body.name).toBe("Analgésicos");
  });

  it("drops unknown and audit fields", async () => {
    Category.create.mockResolvedValue(storedCategory());

    const response = await post({
      ...validBody,
      id: 99,
      createdAt: "2026-09-01",
      updatedAt: "2026-09-01",
      admin: true,
    });

    expect(response.status).toBe(201);
    expect(Category.create).toHaveBeenCalledWith(validBody);
  });

  it("responds 409 when the name already exists", async () => {
    Category.create.mockRejectedValue(
      new UniqueConstraintError({ message: "duplicate" }),
    );

    const response = await post(validBody);

    expect(response.status).toBe(409);
    expect(response.body).toEqual({ message: "Category already exists" });
  });

  it("responds 401 when the token is missing", async () => {
    const response = await post(validBody, null);

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ message: "Unauthorized" });
    expect(Category.create).not.toHaveBeenCalled();
  });

  it("responds 401 when the token is invalid", async () => {
    const response = await post(validBody, "not-a-jwt");

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ message: "Unauthorized" });
    expect(Category.create).not.toHaveBeenCalled();
  });

  it.each(["dispatcher", "manager_warehouse", "support", "customer"])(
    "responds 403 when the authenticated user is %s",
    async (role) => {
      const response = await post(validBody, tokenFor(role));

      expect(response.status).toBe(403);
      expect(response.body).toEqual({ message: "Forbidden" });
      expect(Category.create).not.toHaveBeenCalled();
    },
  );

  it("responds 403 when the authenticated user is blocked", async () => {
    User.findByPk.mockResolvedValue({ ...AUTH_USER, isBlocked: true });

    const response = await post(validBody);

    expect(response.status).toBe(403);
    expect(response.body).toEqual({ message: "User is blocked" });
    expect(Category.create).not.toHaveBeenCalled();
  });

  it.each([{}, { name: "" }, { name: null }])(
    "responds 400 when name is missing in %p",
    async (body) => {
      const response = await post(body);

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ message: "name is required" });
      expect(Category.create).not.toHaveBeenCalled();
    },
  );

  it("responds 422 when the name is invalid", async () => {
    const response = await post({ name: "   " });

    expect(response.status).toBe(422);
    expect(response.body).toEqual({
      errors: { name: "Nombre inválido" },
    });
    expect(Category.create).not.toHaveBeenCalled();
  });

  it("forwards unexpected persistence errors", async () => {
    Category.create.mockRejectedValue(new Error("database exploded"));

    const response = await post(validBody);

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ message: "Server error" });
  });
});

describe("router composition", () => {
  it("mounts the list router on GET /categories", async () => {
    Category.findAll.mockResolvedValue([]);

    const response = await request(app)
      .get("/categories")
      .set("Authorization", `Bearer ${tokenFor()}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual([]);
    expect(Category.findAll).toHaveBeenCalledWith({
      order: [["id", "ASC"]],
    });
  });

  it("mounts the update router on PUT /categories/:id", async () => {
    const category = storedCategory({
      update: jest.fn(function update(values) {
        Object.assign(this, values);
        return Promise.resolve(this);
      }),
    });
    Category.findByPk.mockResolvedValue(category);

    const response = await request(app)
      .put("/categories/1")
      .set("Authorization", `Bearer ${tokenFor()}`)
      .send({ name: "Antiinflamatorios" });

    expect(response.status).toBe(202);
    expect(response.body).toEqual({ id: 1, name: "Antiinflamatorios" });
    expect(category.update).toHaveBeenCalledWith({
      name: "Antiinflamatorios",
    });
  });

  it("mounts the remove router on DELETE /categories/:id", async () => {
    const category = storedCategory({
      destroy: jest.fn().mockResolvedValue(),
    });
    Category.findByPk.mockResolvedValue(category);

    const response = await request(app)
      .delete("/categories/1")
      .set("Authorization", `Bearer ${tokenFor()}`);

    expect(response.status).toBe(204);
    expect(response.text).toBe("");
    expect(category.destroy).toHaveBeenCalledTimes(1);
  });
});
