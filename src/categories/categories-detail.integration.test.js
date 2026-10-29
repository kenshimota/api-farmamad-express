process.env.JWT_SECRET = process.env.JWT_SECRET || "integration-test-secret";

const { DataTypes } = require("sequelize");
const request = require("supertest");
const app = require("../app");
const sequelize = require("../database");
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

const PROBE_TABLE = "category_usage_probe";

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

/**
 * Drops the temporary probe table when it exists, so cleanup is idempotent
 * even after a failed assertion or a partially created table.
 * @param {object} queryInterface - Sequelize query interface.
 * @returns {Promise<void>} Resolves once the table is gone.
 */
async function dropProbeTable(queryInterface) {
  if (await queryInterface.tableExists(PROBE_TABLE)) {
    await queryInterface.dropTable(PROBE_TABLE);
  }
}

/**
 * Creates a temporary table with a foreign key to `categories`. It stands in
 * for the future `products.categoryId` constraint so the 409 path can be
 * exercised against Postgres before HU-15 exists. Only Sequelize query
 * interface calls are used, never raw SQL.
 * @param {object} queryInterface - Sequelize query interface.
 * @returns {Promise<void>} Resolves once the table is ready.
 */
async function createProbeTable(queryInterface) {
  await dropProbeTable(queryInterface);

  await queryInterface.createTable(PROBE_TABLE, {
    id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
    },
    categoryId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: "categories", key: "id" },
      onDelete: "RESTRICT",
      onUpdate: "CASCADE",
    },
  });
}

describe("PUT /categories/:id with a real database", () => {
  it.each(["admin", "seller"])(
    "allows a %s to update the category and answers 202",
    async (role) => {
      const category = await createCategory();
      const token = await tokenFor(role);

      const response = await as(
        "put",
        `/categories/${category.id}`,
        token,
      ).send({ name: "Antiinflamatorios" });

      expect(response.status).toBe(202);
      expect(response.body).toEqual({
        id: category.id,
        name: "Antiinflamatorios",
      });

      const stored = await Category.findByPk(category.id);
      expect(stored.name).toBe("Antiinflamatorios");
    },
  );

  it("trims the name before storing it", async () => {
    const category = await createCategory();
    const token = await tokenFor("admin");

    const response = await as("put", `/categories/${category.id}`, token).send({
      name: "  Antiinflamatorios  ",
    });

    expect(response.status).toBe(202);
    expect(response.body.name).toBe("Antiinflamatorios");
  });

  it("responds 409 when the name belongs to another category", async () => {
    await createCategory();
    const other = await createCategory({ name: "Antiinflamatorios" });
    const token = await tokenFor("seller");

    const response = await as("put", `/categories/${other.id}`, token).send(
      BODY,
    );

    expect(response.status).toBe(409);
    expect(response.body).toEqual({ message: "Category already exists" });
  });

  it("responds 404 and 422 for unknown and invalid ids", async () => {
    const token = await tokenFor("admin");

    const missing = await as("put", "/categories/99999", token).send(BODY);
    expect(missing.status).toBe(404);
    expect(missing.body).toEqual({ message: "Category not found" });

    const invalid = await as("put", "/categories/0", token).send(BODY);
    expect(invalid.status).toBe(422);
    expect(invalid.body).toEqual({
      errors: { id: "Invalid category id" },
    });
  });

  it("responds 400 and 422 for missing and invalid fields", async () => {
    const category = await createCategory();
    const token = await tokenFor("admin");

    const missing = await as("put", `/categories/${category.id}`, token).send(
      {},
    );
    expect(missing.status).toBe(400);
    expect(missing.body).toEqual({ message: "name is required" });

    const invalid = await as("put", `/categories/${category.id}`, token).send({
      name: "   ",
    });
    expect(invalid.status).toBe(422);
    expect(invalid.body).toEqual({
      errors: { name: "Nombre inválido" },
    });
  });

  it("responds 403 for a dispatcher user", async () => {
    const category = await createCategory();
    const token = await tokenFor("dispatcher");

    const response = await as("put", `/categories/${category.id}`, token).send(
      BODY,
    );

    expect(response.status).toBe(403);
    expect(response.body).toEqual({ message: "Forbidden" });
  });
});

describe("DELETE /categories/:id with a real database", () => {
  it.each(["admin", "seller"])(
    "allows a %s to delete the category and answers 204",
    async (role) => {
      const category = await createCategory();
      const token = await tokenFor(role);

      const response = await as("delete", `/categories/${category.id}`, token);

      expect(response.status).toBe(204);
      expect(response.text).toBe("");
      await expect(Category.findByPk(category.id)).resolves.toBeNull();
    },
  );

  it("responds 409 and keeps the category when a product references it", async () => {
    const category = await createCategory();
    const token = await tokenFor("admin");
    const queryInterface = sequelize.getQueryInterface();

    try {
      await createProbeTable(queryInterface);
      await queryInterface.bulkInsert(PROBE_TABLE, [
        { categoryId: category.id },
      ]);

      const response = await as("delete", `/categories/${category.id}`, token);

      expect(response.status).toBe(409);
      expect(response.body).toEqual({ message: "Category is in use" });
      await expect(Category.findByPk(category.id)).resolves.not.toBeNull();
    } finally {
      await dropProbeTable(queryInterface);
    }
  });

  it("responds 404 and 422 for unknown and invalid ids", async () => {
    const token = await tokenFor("admin");

    const missing = await as("delete", "/categories/99999", token);
    expect(missing.status).toBe(404);
    expect(missing.body).toEqual({ message: "Category not found" });

    const invalid = await as("delete", "/categories/abc", token);
    expect(invalid.status).toBe(422);
    expect(invalid.body).toEqual({
      errors: { id: "Invalid category id" },
    });
  });

  it("responds 403 for a dispatcher user", async () => {
    const category = await createCategory();
    const token = await tokenFor("dispatcher");

    const response = await as("delete", `/categories/${category.id}`, token);

    expect(response.status).toBe(403);
    expect(response.body).toEqual({ message: "Forbidden" });
  });

  it("responds 401 without a token", async () => {
    const category = await createCategory();
    const response = await request(app).delete(`/categories/${category.id}`);

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ message: "Unauthorized" });
  });
});
