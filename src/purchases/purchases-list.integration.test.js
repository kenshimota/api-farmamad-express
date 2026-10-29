process.env.JWT_SECRET = process.env.JWT_SECRET || "integration-test-secret";

const sequelize = require("../database");
const { assertTestDatabase } = require("../../test/helpers/test-database");
const {
  as,
  createPurchase,
  createPurchaseItem,
  createPurchaseSupplier,
  resetDatabase,
  tokenFor,
} = require("../../test/helpers/purchases");

beforeAll(async () => {
  assertTestDatabase(sequelize.config.database);
  await sequelize.authenticate();
});

beforeEach(async () => {
  assertTestDatabase(sequelize.config.database);
  await resetDatabase();
});

afterAll(async () => {
  await resetDatabase();
  await sequelize.close();
});

describe("GET /purchases with a real database", () => {
  it("lists by number descending, filters and optionally includes items", async () => {
    const supplier = await createPurchaseSupplier();
    const first = await createPurchase({ supplier_id: supplier.id });
    const second = await createPurchase({ supplier_id: supplier.id });
    await createPurchaseItem({ purchase_id: second.id });
    const token = await tokenFor("manager_warehouse");

    const list = await as("get", "/purchases", token);
    expect(list.status).toBe(200);
    expect(list.body.map((row) => row.number)).toEqual([2, 1]);
    expect(list.body[0]).not.toHaveProperty("items");

    const filtered = await as(
      "get",
      `/purchases?supplier_id=${supplier.id}&status=draft&number=${first.number}`,
      token,
    );
    expect(filtered.status).toBe(200);
    expect(filtered.body).toHaveLength(1);
    expect(filtered.body[0].id).toBe(first.id);

    const included = await as("get", "/purchases?include=items", token);
    expect(included.status).toBe(200);
    expect(included.body[0].items).toHaveLength(1);
    expect(included.body[0].items[0]).not.toHaveProperty("createdAt");

    const detail = await as("get", `/purchases/${second.id}`, token);
    expect(detail.status).toBe(200);
    expect(detail.body.items).toEqual([
      expect.objectContaining({ product_id: expect.any(Number) }),
    ]);
    expect(detail.body.supplier).toEqual(
      expect.objectContaining({ id: supplier.id }),
    );
    expect(detail.body).not.toHaveProperty("createdAt");
  });

  it("responds 422 for invalid filters and ids, 404 for a missing purchase", async () => {
    const token = await tokenFor("admin");

    const invalidStatus = await as("get", "/purchases?status=paid", token);
    expect(invalidStatus.status).toBe(422);
    expect(invalidStatus.body).toEqual({
      errors: { status: "Invalid status" },
    });

    const invalidNumber = await as("get", "/purchases?number=abc", token);
    expect(invalidNumber.status).toBe(422);

    const invalidId = await as("get", "/purchases/abc", token);
    expect(invalidId.status).toBe(422);

    const missing = await as("get", "/purchases/99999", token);
    expect(missing.status).toBe(404);
    expect(missing.body).toEqual({ message: "Purchase not found" });
  });

  it.each(["admin", "seller", "manager_warehouse"])(
    "allows a %s to read",
    async (role) => {
      await createPurchase();
      const token = await tokenFor(role);

      const response = await as("get", "/purchases", token);

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(1);
    },
  );

  it.each(["dispatcher", "support", "customer"])(
    "responds 403 for a %s",
    async (role) => {
      const token = await tokenFor(role);

      const response = await as("get", "/purchases", token);

      expect(response.status).toBe(403);
    },
  );
});
