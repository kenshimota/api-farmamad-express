process.env.JWT_SECRET = process.env.JWT_SECRET || "integration-test-secret";

const jwt = require("jsonwebtoken");
const request = require("supertest");
const app = require("../app");
const sequelize = require("../database");
const User = require("../models/user");
const Role = require("../models/role");
const { assertTestDatabase } = require("../../test/helpers/test-database");

const HIGH_VOLUME = [
  "/products",
  "/users",
  "/customers",
  "/suppliers",
  "/images",
  "/costs",
  "/stocks",
  "/lots",
  "/purchases",
  "/orders",
  "/invoices",
  "/payments",
  "/customer-wallets?customer_id=1",
];
const AUTOCOMPLETE = [
  "/products",
  "/users",
  "/customers",
  "/suppliers",
  "/invoices",
  "/orders",
  "/purchases",
];

let token;

/**
 * Sends a GET request with the shared admin token.
 * @param {string} path - Request path.
 * @returns {import("supertest").Test} Supertest request.
 */
function get(path) {
  return request(app).get(path).set("Authorization", `Bearer ${token}`);
}

beforeAll(async () => {
  assertTestDatabase(sequelize.config.database);
  await sequelize.authenticate();

  const role = await Role.findOne({ where: { name: "admin" } });
  const suffix = `${Date.now()}-${process.pid}`;
  const username = `hu48-admin-${suffix}`;
  const user = await User.create({
    username,
    email: `${username}@example.com`,
    name: "HU48 Admin",
    password: "secret123",
    roleId: role.id,
  });

  token = jwt.sign(
    { sub: user.id, username, role: "admin" },
    process.env.JWT_SECRET,
    {
      expiresIn: "1h",
    },
  );
});

afterAll(async () => {
  await sequelize.close();
});

describe.each(HIGH_VOLUME)("GET %s", (path) => {
  it("returns the paginated envelope when page is sent", async () => {
    const separator = path.includes("?") ? "&" : "?";
    const response = await get(`${path}${separator}page=1&page_size=5`);

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body.data)).toBe(true);
    expect(response.body.meta).toEqual(
      expect.objectContaining({
        page: 1,
        page_size: 5,
        total: expect.any(Number),
        total_pages: expect.any(Number),
        has_next: expect.any(Boolean),
        has_prev: false,
      }),
    );
  });

  it("answers 422 for an invalid page or page_size", async () => {
    const separator = path.includes("?") ? "&" : "?";

    const invalidPage = await get(`${path}${separator}page=0`);
    expect(invalidPage.status).toBe(422);
    expect(invalidPage.body.errors).toHaveProperty("page");

    const invalidSize = await get(`${path}${separator}page_size=101`);
    expect(invalidSize.status).toBe(422);
    expect(invalidSize.body.errors).toHaveProperty("page_size");
  });
});

describe.each(AUTOCOMPLETE)("autocomplete on %s", (path) => {
  it("returns the paginated envelope for q with a small page_size", async () => {
    const response = await get(`${path}?q=zzzz-no-match&page_size=10`);

    expect(response.status).toBe(200);
    expect(response.body.meta).toEqual(
      expect.objectContaining({ page: 1, page_size: 10, total: 0 }),
    );
    expect(response.body.data).toEqual([]);
  });
});

describe("high-volume module filters", () => {
  it("applies invoice_id to payments without a query error", async () => {
    const response = await get("/payments?invoice_id=999&page=1&page_size=5");

    expect(response.status).toBe(200);
    expect(response.body.meta.total).toBe(0);
  });

  it("applies warehouse_id to stocks without a query error", async () => {
    const response = await get("/stocks?warehouse_id=999&page=1&page_size=5");

    expect(response.status).toBe(200);
    expect(response.body.meta.total).toBe(0);
  });

  it("applies the date range filters inclusively", async () => {
    const response = await get(
      "/payments?from=2026-01-01&to=2026-12-31&page=1&page_size=5",
    );

    expect(response.status).toBe(200);
    expect(response.body.meta.page).toBe(1);
  });

  it("filters lots by expiration and supplier parameters", async () => {
    const expires = await get(
      "/lots?expires_from=2026-01-01&expires_to=2026-12-31&page=1&page_size=5",
    );
    const supplier = await get("/lots?supplier_id=999&page=1&page_size=5");

    expect(expires.status).toBe(200);
    expect(supplier.status).toBe(200);
  });

  it("applies the module-specific filters without query errors", async () => {
    const paths = [
      "/users?role=admin&is_active=true&page=1&page_size=5",
      "/customers?seller_id=1&page=1&page_size=5",
      "/products?reference=IBU&category_id=1&tax_id=1&page=1&page_size=5",
      "/invoices?status=pending&from=2026-01-01&to=2026-12-31&due_from=2026-01-01&due_to=2026-12-31&page=1&page_size=5",
      "/orders?status=draft&created_from=2026-01-01&created_to=2026-12-31&page=1&page_size=5",
      "/purchases?status=draft&from=2026-01-01&to=2026-12-31&page=1&page_size=5",
      "/payments?status=pending&page=1&page_size=5",
      "/stocks?low_stock=true&page=1&page_size=5",
      "/lots?location_status=located&page=1&page_size=5",
      "/costs?from=2026-01-01&to=2026-12-31&page=1&page_size=5",
    ];

    for (const path of paths) {
      const response = await get(path);

      expect(response.status).toBe(200);
      expect(response.body.meta).toBeDefined();
    }
  });

  it("keeps the flat array and ignores catalog pagination", async () => {
    const products = await get("/products");
    const taxes = await get("/taxes?page=2&page_size=5");

    expect(products.status).toBe(200);
    expect(Array.isArray(products.body)).toBe(true);
    expect(taxes.status).toBe(200);
    expect(Array.isArray(taxes.body)).toBe(true);
  });
});
