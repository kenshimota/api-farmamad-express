process.env.JWT_SECRET = process.env.JWT_SECRET || "integration-test-secret";

const request = require("supertest");
const app = require("../app");
const sequelize = require("../database");
const User = require("../models/user");
const Product = require("../models/product");
const { assertTestDatabase } = require("../../test/helpers/test-database");
const {
  BODY,
  as,
  createCategory,
  createImage,
  createProduct,
  resetDatabase,
  tokenFor,
} = require("../../test/helpers/products");

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
 * Creates the category and image referenced by the request body.
 * @returns {Promise<{ category_id: number, image_id: number }>} Foreign keys.
 */
async function referenceIds() {
  const [category, image] = await Promise.all([
    createCategory(),
    createImage(),
  ]);

  return { category_id: category.id, image_id: image.id };
}

describe("POST /products with a real database", () => {
  it.each(["admin", "seller"])(
    "allows a %s to create a product and answers 201",
    async (role) => {
      const token = await tokenFor(role);
      const ids = await referenceIds();

      const response = await as("post", "/products", token).send({
        ...BODY,
        ...ids,
      });

      expect(response.status).toBe(201);
      expect(response.body).toEqual({
        id: expect.any(Number),
        ...BODY,
        ...ids,
      });
      expect(response.body).not.toHaveProperty("createdAt");
      expect(response.body).not.toHaveProperty("updatedAt");

      const stored = await Product.findByPk(response.body.id);
      expect(stored.reference).toBe(BODY.reference);
    },
  );

  it("trims the text fields before storing them", async () => {
    const token = await tokenFor("admin");
    const ids = await referenceIds();

    const response = await as("post", "/products", token).send({
      ...BODY,
      name: `  ${BODY.name}  `,
      description: `  ${BODY.description}  `,
      reference: `  ${BODY.reference}  `,
      ...ids,
    });

    expect(response.status).toBe(201);
    expect(response.body.name).toBe(BODY.name);
    expect(response.body.description).toBe(BODY.description);
    expect(response.body.reference).toBe(BODY.reference);
  });

  it("discards unknown and audit fields", async () => {
    const token = await tokenFor("admin");
    const ids = await referenceIds();

    const response = await as("post", "/products", token).send({
      ...BODY,
      ...ids,
      id: 99,
      createdAt: "2026-09-01",
      updatedAt: "2026-09-01",
      admin: true,
    });

    expect(response.status).toBe(201);
    expect(response.body).not.toHaveProperty("createdAt");
    expect(response.body.id).not.toBe(99);
  });

  it("responds 409 when the reference already exists", async () => {
    await createProduct({ reference: BODY.reference });
    const token = await tokenFor("admin");
    const ids = await referenceIds();

    const response = await as("post", "/products", token).send({
      ...BODY,
      ...ids,
    });

    expect(response.status).toBe(409);
    expect(response.body).toEqual({ message: "Product already exists" });
  });

  it("responds 422 when the category does not exist", async () => {
    const token = await tokenFor("admin");
    const image = await createImage();

    const response = await as("post", "/products", token).send({
      ...BODY,
      category_id: 99999,
      image_id: image.id,
    });

    expect(response.status).toBe(422);
    expect(response.body).toEqual({
      errors: { category_id: "Invalid category id" },
    });
  });

  it("responds 422 when the image does not exist", async () => {
    const token = await tokenFor("admin");
    const category = await createCategory();

    const response = await as("post", "/products", token).send({
      ...BODY,
      category_id: category.id,
      image_id: 99999,
    });

    expect(response.status).toBe(422);
    expect(response.body).toEqual({
      errors: { image_id: "Invalid image id" },
    });
  });

  it("responds 401 without a token", async () => {
    const ids = await referenceIds();

    const response = await request(app)
      .post("/products")
      .send({
        ...BODY,
        ...ids,
      });

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ message: "Unauthorized" });
  });

  it.each(["dispatcher", "manager_warehouse", "support", "customer"])(
    "responds 403 for a %s",
    async (role) => {
      const token = await tokenFor(role);
      const ids = await referenceIds();

      const response = await as("post", "/products", token).send({
        ...BODY,
        ...ids,
      });

      expect(response.status).toBe(403);
      expect(response.body).toEqual({ message: "Forbidden" });
    },
  );

  it("responds 400 and 422 for missing and invalid fields", async () => {
    const token = await tokenFor("admin");
    const ids = await referenceIds();

    const missing = await as("post", "/products", token).send({});
    expect(missing.status).toBe(400);
    expect(missing.body).toEqual({
      message:
        "name, description, reference, category_id and image_id are required",
    });

    const invalid = await as("post", "/products", token).send({
      ...BODY,
      ...ids,
      reference: "   ",
    });
    expect(invalid.status).toBe(422);
    expect(invalid.body).toEqual({
      errors: { reference: "Referencia inválida" },
    });
  });

  it("responds 403 for a blocked user", async () => {
    const token = await tokenFor("admin");
    const ids = await referenceIds();
    await User.update({ isBlocked: true }, { where: { username: "admin" } });

    const response = await as("get", "/products", token);

    expect(response.status).toBe(403);
    expect(response.body).toEqual({ message: "User is blocked" });
  });
});
