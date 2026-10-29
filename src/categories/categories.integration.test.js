process.env.JWT_SECRET = process.env.JWT_SECRET || "integration-test-secret";

const request = require("supertest");
const app = require("../app");
const sequelize = require("../database");
const User = require("../models/user");
const Category = require("../models/category");
const { assertTestDatabase } = require("../../test/helpers/test-database");
const {
  BODY,
  PUBLIC_CATEGORY,
  as,
  createCategory,
  resetDatabase,
  tokenFor,
} = require("../../test/helpers/categories");

beforeAll(async () => {
  assertTestDatabase(sequelize.config.database);
  await sequelize.authenticate();
});

beforeEach(async () => {
  assertTestDatabase(sequelize.config.database);
  await resetDatabase();
});

afterAll(async () => {
  await sequelize.close();
});

describe("POST /categories with a real database", () => {
  it.each(["admin", "seller"])(
    "allows a %s to create a category and answers 201",
    async (role) => {
      const token = await tokenFor(role);

      const response = await as("post", "/categories", token).send(BODY);

      expect(response.status).toBe(201);
      expect(response.body).toEqual(PUBLIC_CATEGORY);
      expect(response.body).not.toHaveProperty("createdAt");
      expect(response.body).not.toHaveProperty("updatedAt");

      const stored = await Category.findByPk(response.body.id);
      expect(stored.name).toBe(BODY.name);
    },
  );

  it("trims the name before storing it", async () => {
    const token = await tokenFor("admin");

    const response = await as("post", "/categories", token).send({
      name: "  Analgésicos  ",
    });

    expect(response.status).toBe(201);
    expect(response.body.name).toBe("Analgésicos");
  });

  it("discards unknown and audit fields", async () => {
    const token = await tokenFor("admin");

    const response = await as("post", "/categories", token).send({
      ...BODY,
      id: 99,
      createdAt: "2026-09-01",
      updatedAt: "2026-09-01",
      admin: true,
    });

    expect(response.status).toBe(201);
    expect(response.body).not.toHaveProperty("createdAt");
    expect(response.body.id).not.toBe(99);
  });

  it("responds 409 when the name already exists", async () => {
    await createCategory();
    const token = await tokenFor("admin");

    const response = await as("post", "/categories", token).send(BODY);

    expect(response.status).toBe(409);
    expect(response.body).toEqual({ message: "Category already exists" });
  });

  it("responds 401 without a token", async () => {
    const response = await request(app).post("/categories").send(BODY);

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ message: "Unauthorized" });
  });

  it.each(["dispatcher", "manager_warehouse", "support", "customer"])(
    "responds 403 for a %s",
    async (role) => {
      const token = await tokenFor(role);

      const response = await as("post", "/categories", token).send(BODY);

      expect(response.status).toBe(403);
      expect(response.body).toEqual({ message: "Forbidden" });
    },
  );

  it("responds 400 and 422 for missing and invalid fields", async () => {
    const token = await tokenFor("admin");

    const missing = await as("post", "/categories", token).send({});
    expect(missing.status).toBe(400);
    expect(missing.body).toEqual({ message: "name is required" });

    const invalid = await as("post", "/categories", token).send({
      name: "   ",
    });
    expect(invalid.status).toBe(422);
    expect(invalid.body).toEqual({
      errors: { name: "Nombre inválido" },
    });
  });

  it("responds 403 for a blocked user", async () => {
    const token = await tokenFor("admin");
    await User.update({ isBlocked: true }, { where: { username: "admin" } });

    const response = await as("get", "/categories", token);

    expect(response.status).toBe(403);
    expect(response.body).toEqual({ message: "User is blocked" });
  });
});

describe("GET /categories with a real database", () => {
  it("returns the categories ordered by id with public fields", async () => {
    const first = await createCategory();
    const second = await createCategory({
      name: "Antiinflamatorios",
    });
    const token = await tokenFor("dispatcher");

    const response = await as("get", "/categories", token);

    expect(response.status).toBe(200);
    expect(response.body).toEqual([
      { ...PUBLIC_CATEGORY, id: first.id },
      { id: second.id, name: "Antiinflamatorios" },
    ]);
  });

  it("returns an empty array when there are no categories", async () => {
    const token = await tokenFor("admin");

    const response = await as("get", "/categories", token);

    expect(response.status).toBe(200);
    expect(response.body).toEqual([]);
  });

  it.each([
    "admin",
    "seller",
    "dispatcher",
    "manager_warehouse",
    "support",
    "customer",
  ])("allows a %s to read the list", async (role) => {
    await createCategory();
    const token = await tokenFor(role);

    const response = await as("get", "/categories", token);

    expect(response.status).toBe(200);
    expect(response.body).toEqual([PUBLIC_CATEGORY]);
  });
});

describe("GET /categories/:id with a real database", () => {
  it("returns one category for the allowed roles", async () => {
    const category = await createCategory();
    const token = await tokenFor("customer");

    const response = await as("get", `/categories/${category.id}`, token);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ ...PUBLIC_CATEGORY, id: category.id });
  });

  it("responds 404 and 422 for unknown and invalid ids", async () => {
    const token = await tokenFor("admin");

    const missing = await as("get", "/categories/99999", token);
    expect(missing.status).toBe(404);
    expect(missing.body).toEqual({ message: "Category not found" });

    const invalid = await as("get", "/categories/abc", token);
    expect(invalid.status).toBe(422);
    expect(invalid.body).toEqual({
      errors: { id: "Invalid category id" },
    });
  });
});
