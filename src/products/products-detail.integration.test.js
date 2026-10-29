process.env.JWT_SECRET = process.env.JWT_SECRET || "integration-test-secret";

const request = require("supertest");
const app = require("../app");
const sequelize = require("../database");
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

describe("PUT /products/:id with a real database", () => {
  it.each(["admin", "seller"])(
    "allows a %s to update the product and answers 202",
    async (role) => {
      const product = await createProduct();
      const token = await tokenFor(role);
      const changes = {
        ...BODY,
        name: "Ibuprofeno 800 mg",
        reference: "IBU-800",
        category_id: product.category_id,
        image_id: product.image_id,
      };

      const response = await as("put", `/products/${product.id}`, token).send(
        changes,
      );

      expect(response.status).toBe(202);
      expect(response.body).toEqual({ id: product.id, ...changes });

      const stored = await Product.findByPk(product.id);
      expect(stored.name).toBe(changes.name);
      expect(stored.reference).toBe(changes.reference);
    },
  );

  it("trims the text fields before storing them", async () => {
    const product = await createProduct();
    const token = await tokenFor("admin");

    const response = await as("put", `/products/${product.id}`, token).send({
      ...BODY,
      name: `  ${BODY.name}  `,
      reference: `  ${BODY.reference}  `,
      category_id: product.category_id,
      image_id: product.image_id,
    });

    expect(response.status).toBe(202);
    expect(response.body.name).toBe(BODY.name);
    expect(response.body.reference).toBe(BODY.reference);
  });

  it("responds 409 when the reference belongs to another product", async () => {
    await createProduct({ reference: BODY.reference });
    const other = await createProduct({ reference: "PAR-500" });
    const token = await tokenFor("seller");

    const response = await as("put", `/products/${other.id}`, token).send({
      ...BODY,
      reference: BODY.reference,
      category_id: other.category_id,
      image_id: other.image_id,
    });

    expect(response.status).toBe(409);
    expect(response.body).toEqual({ message: "Product already exists" });
  });

  it("responds 422 when a referenced category or image is missing", async () => {
    const product = await createProduct();
    const token = await tokenFor("admin");
    const base = {
      ...BODY,
      reference: "IBU-900",
    };

    const missingCategory = await as(
      "put",
      `/products/${product.id}`,
      token,
    ).send({
      ...base,
      category_id: 99999,
      image_id: product.image_id,
    });
    expect(missingCategory.status).toBe(422);
    expect(missingCategory.body).toEqual({
      errors: { category_id: "Invalid category id" },
    });

    const missingImage = await as("put", `/products/${product.id}`, token).send(
      {
        ...base,
        category_id: product.category_id,
        image_id: 99999,
      },
    );
    expect(missingImage.status).toBe(422);
    expect(missingImage.body).toEqual({
      errors: { image_id: "Invalid image id" },
    });
  });

  it("responds 404 and 422 for unknown and invalid ids", async () => {
    const token = await tokenFor("admin");
    const category = await createCategory();
    const image = await createImage();
    const body = { ...BODY, category_id: category.id, image_id: image.id };

    const missing = await as("put", "/products/99999", token).send(body);
    expect(missing.status).toBe(404);
    expect(missing.body).toEqual({ message: "Product not found" });

    const invalid = await as("put", "/products/0", token).send(body);
    expect(invalid.status).toBe(422);
    expect(invalid.body).toEqual({ errors: { id: "Invalid product id" } });
  });

  it("responds 400 and 422 for missing and invalid fields", async () => {
    const product = await createProduct();
    const token = await tokenFor("admin");

    const missing = await as("put", `/products/${product.id}`, token).send({});
    expect(missing.status).toBe(400);
    expect(missing.body).toEqual({
      message:
        "name, description, reference, category_id and image_id are required",
    });

    const invalid = await as("put", `/products/${product.id}`, token).send({
      ...BODY,
      category_id: product.category_id,
      image_id: product.image_id,
      name: "a".repeat(151),
    });
    expect(invalid.status).toBe(422);
    expect(invalid.body).toEqual({
      errors: { name: "Nombre inválido" },
    });
  });

  it("responds 403 for a dispatcher user", async () => {
    const product = await createProduct();
    const token = await tokenFor("dispatcher");

    const response = await as("put", `/products/${product.id}`, token).send({
      ...BODY,
      category_id: product.category_id,
      image_id: product.image_id,
    });

    expect(response.status).toBe(403);
    expect(response.body).toEqual({ message: "Forbidden" });
  });
});

describe("DELETE /products/:id with a real database", () => {
  it.each(["admin", "seller"])(
    "allows a %s to delete the product and answers 204",
    async (role) => {
      const product = await createProduct();
      const token = await tokenFor(role);

      const response = await as("delete", `/products/${product.id}`, token);

      expect(response.status).toBe(204);
      expect(response.text).toBe("");
      await expect(Product.findByPk(product.id)).resolves.toBeNull();
    },
  );

  it("responds 404 and 422 for unknown and invalid ids", async () => {
    const token = await tokenFor("admin");

    const missing = await as("delete", "/products/99999", token);
    expect(missing.status).toBe(404);
    expect(missing.body).toEqual({ message: "Product not found" });

    const invalid = await as("delete", "/products/abc", token);
    expect(invalid.status).toBe(422);
    expect(invalid.body).toEqual({ errors: { id: "Invalid product id" } });
  });

  it("responds 403 for a dispatcher user", async () => {
    const product = await createProduct();
    const token = await tokenFor("dispatcher");

    const response = await as("delete", `/products/${product.id}`, token);

    expect(response.status).toBe(403);
    expect(response.body).toEqual({ message: "Forbidden" });
  });

  it("responds 401 without a token", async () => {
    const product = await createProduct();

    const response = await request(app).delete(`/products/${product.id}`);

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ message: "Unauthorized" });
  });
});
