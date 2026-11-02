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
    tax_id: product.tax_id,
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

describe("GET /products pagination, filters and autocomplete", () => {
  it("returns the paginated envelope with stable ordering", async () => {
    const first = await createProduct();
    const second = await createProduct({
      name: "Ibuprofeno 600 mg",
      reference: "IBU-600",
    });
    const third = await createProduct({
      name: "Paracetamol 500 mg",
      reference: "PAR-500",
    });
    const token = await tokenFor("admin");

    const response = await as(
      "get",
      "/products?page=2&page_size=2&sort=name&order=asc",
      token,
    );

    expect(response.status).toBe(200);
    expect(response.body.meta).toEqual({
      page: 2,
      page_size: 2,
      total: 3,
      total_pages: 2,
      has_next: false,
      has_prev: true,
    });
    expect(response.body.data).toEqual([
      publicProduct(
        [first, second, third].sort((a, b) => a.name.localeCompare(b.name))[2],
      ),
    ]);
  });

  it("filters by category, tax, reference and q", async () => {
    const category = await createCategory({ name: "Analgésicos HU48" });
    const image = await createImage({ reference: "hu48-image" });
    const tax = await createProduct({ reference: "HU48-TAX" }).then(
      (product) => product.tax_id,
    );
    const matching = await createProduct({
      name: "Ibuprofeno HU48",
      description: "Antiinflamatorio",
      reference: "HU48-IBU",
      category_id: category.id,
      image_id: image.id,
      tax_id: tax,
    });
    await createProduct({
      name: "Paracetamol HU48",
      reference: "HU48-PAR",
    });
    const token = await tokenFor("admin");

    const response = await as(
      "get",
      `/products?category_id=${category.id}&tax_id=${tax}&image_id=${image.id}&reference=HU48-IBU&q=ibu&page_size=10`,
      token,
    );

    expect(response.status).toBe(200);
    expect(response.body.meta.total).toBe(1);
    expect(response.body.data).toEqual([publicProduct(matching)]);
  });

  it("supports autocomplete by q with a small page_size", async () => {
    const matching = await createProduct({
      name: "Ibuprofeno autocomplete",
      reference: "AUTO-IBU",
    });
    await createProduct({
      name: "Paracetamol autocomplete",
      reference: "AUTO-PAR",
    });
    const token = await tokenFor("admin");

    const response = await as("get", "/products?q=ibu&page_size=10", token);

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual([publicProduct(matching)]);
    expect(response.body.meta.total).toBe(1);
  });

  it.each([
    "?page=0",
    "?page_size=101",
    "?sort=description",
    "?order=up",
    "?category_id=abc",
  ])("answers 422 for %s", async (query) => {
    const token = await tokenFor("admin");

    const response = await as("get", `/products${query}`, token);

    expect(response.status).toBe(422);
    expect(response.body.errors).toBeDefined();
  });
});
