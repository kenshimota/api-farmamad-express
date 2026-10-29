process.env.JWT_SECRET = process.env.JWT_SECRET || "integration-test-secret";

const sequelize = require("../database");
const { assertTestDatabase } = require("../../test/helpers/test-database");
const {
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
 * Builds the expected public product body.
 * @param {object} product - Stored product instance.
 * @returns {object} Public representation.
 */
function publicProduct(product) {
  return {
    id: product.id,
    name: product.name,
    description: product.description,
    reference: product.reference,
    category_id: product.category_id,
    image_id: product.image_id,
  };
}

describe("GET /products with a real database", () => {
  it("returns the products ordered by id with public fields", async () => {
    const first = await createProduct();
    const category = await createCategory({ name: "Antiinflamatorios" });
    const image = await createImage({
      reference: "paracetamol-500",
      url: "https://cdn.farmamad.com/products/paracetamol.png",
      thumbnail: "https://cdn.farmamad.com/products/paracetamol-thumb.png",
    });
    const second = await createProduct({
      name: "Paracetamol 500 mg",
      description: "Analgésico y antipirético",
      reference: "PAR-500",
      category_id: category.id,
      image_id: image.id,
    });
    const token = await tokenFor("dispatcher");

    const response = await as("get", "/products", token);

    expect(response.status).toBe(200);
    expect(response.body).toEqual([
      publicProduct(first),
      publicProduct(second),
    ]);
  });

  it("returns an empty array when there are no products", async () => {
    const token = await tokenFor("admin");

    const response = await as("get", "/products", token);

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
    const product = await createProduct();
    const token = await tokenFor(role);

    const response = await as("get", "/products", token);

    expect(response.status).toBe(200);
    expect(response.body).toEqual([publicProduct(product)]);
  });
});

describe("GET /products/:id with a real database", () => {
  it("returns one product for the allowed roles", async () => {
    const product = await createProduct();
    const token = await tokenFor("customer");

    const response = await as("get", `/products/${product.id}`, token);

    expect(response.status).toBe(200);
    expect(response.body).toEqual(publicProduct(product));
  });

  it("responds 404 and 422 for unknown and invalid ids", async () => {
    const token = await tokenFor("admin");

    const missing = await as("get", "/products/99999", token);
    expect(missing.status).toBe(404);
    expect(missing.body).toEqual({ message: "Product not found" });

    const invalid = await as("get", "/products/abc", token);
    expect(invalid.status).toBe(422);
    expect(invalid.body).toEqual({ errors: { id: "Invalid product id" } });
  });
});
