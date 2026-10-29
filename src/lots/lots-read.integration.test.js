process.env.JWT_SECRET = process.env.JWT_SECRET || "integration-test-secret";

const request = require("supertest");
const app = require("../app");
const sequelize = require("../database");
const Lot = require("../models/lot");
const { assertTestDatabase } = require("../../test/helpers/test-database");
const {
  as,
  createLot,
  createReferences,
  createShelf,
  lotBody,
  resetDatabase,
  tokenFor,
  uniqueNumber,
} = require("../../test/helpers/lots");

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
describe("GET /lots with a real database", () => {
  it("lists lots ordered by expiration date and id with relations", async () => {
    const references = await createReferences();
    const later = await createLot(references, {
      number: uniqueNumber(),
      expiration_date: "2099-12-31",
    });
    const earlier = await createLot(references, {
      number: uniqueNumber(),
      expiration_date: "2020-01-01",
    });
    const token = await tokenFor("dispatcher");

    const response = await as("get", "/lots", token);

    expect(response.status).toBe(200);
    expect(response.body.map((lot) => lot.id)).toEqual([earlier.id, later.id]);
    expect(response.body[0]).toEqual(
      expect.objectContaining({
        available: 0,
        product: expect.objectContaining({ id: references.product.id }),
        item_state: expect.objectContaining({
          id: references.itemState.id,
        }),
        warehouse: expect.objectContaining({
          id: references.warehouse.id,
        }),
        shelf: expect.objectContaining({ id: references.shelf.id }),
        section: expect.objectContaining({ id: references.section.id }),
      }),
    );
  });

  it("filters by product, state, location, number, expiration and before date", async () => {
    const references = await createReferences();
    const other = await createReferences({
      productData: { reference: "OTHER-2", name: "Otro" },
    });
    const target = await createLot(references, {
      number: "L-FILTER-1",
      expiration_date: "2030-06-15",
    });
    await createLot(references, {
      number: "L-OTHER",
      expiration_date: "2020-01-01",
    });
    await createLot(other, { number: "L-OTHER-PRODUCT" });
    const token = await tokenFor("seller");

    const filters = new URLSearchParams({
      product_id: String(references.product.id),
      item_state_id: String(references.itemState.id),
      warehouse_id: String(references.warehouse.id),
      shelf_id: String(references.shelf.id),
      section_id: String(references.section.id),
      number: "l-filter-1",
    });
    const response = await as("get", `/lots?${filters}`, token);

    expect(response.status).toBe(200);
    expect(response.body.map((lot) => lot.id)).toEqual([target.id]);

    const notExpired = await as("get", "/lots?expired=false", token);
    expect(notExpired.status).toBe(200);
    expect(notExpired.body.map((lot) => lot.number)).not.toContain("L-OTHER");
    expect(notExpired.body.map((lot) => lot.number)).toContain("L-FILTER-1");

    const expired = await as("get", "/lots?expired=true", token);
    expect(expired.status).toBe(200);
    expect(expired.body.map((lot) => lot.number)).toEqual(["L-OTHER"]);

    const before = await as(
      "get",
      `/lots?product_id=${references.product.id}&expiring_before=2030-06-15`,
      token,
    );
    expect(before.status).toBe(200);
    expect(before.body.map((lot) => lot.number)).toEqual([
      "L-OTHER",
      "L-FILTER-1",
    ]);
  });

  it("validates every filter before querying", async () => {
    const token = await tokenFor("admin");

    for (const query of [
      "product_id=abc",
      "item_state_id=0",
      "warehouse_id=1.5",
      "shelf_id=abc",
      "section_id=-1",
      "number=",
      "expired=maybe",
      "expiring_before=2026-02-30",
    ]) {
      const response = await as("get", `/lots?${query}`, token);

      expect(response.status).toBe(422);
      expect(Object.keys(response.body.errors)).toHaveLength(1);
    }
  });

  it("returns one lot, 404 for an unknown id and 422 for an invalid id", async () => {
    const references = await createReferences();
    const lot = await createLot(references, { stock: 8, reserved: 3 });
    const token = await tokenFor("manager_warehouse");

    const detail = await as("get", `/lots/${lot.id}`, token);
    expect(detail.status).toBe(200);
    expect(detail.body.available).toBe(5);

    const missing = await as("get", "/lots/99999", token);
    expect(missing.status).toBe(404);
    expect(missing.body).toEqual({ message: "Lot not found" });

    const invalid = await as("get", "/lots/abc", token);
    expect(invalid.status).toBe(422);
    expect(invalid.body).toEqual({ errors: { id: "Invalid lot id" } });
  });

  it("responds 401 and 403 for unauthorized reads", async () => {
    const anonymous = await request(app).get("/lots");
    expect(anonymous.status).toBe(401);
    expect(anonymous.body).toEqual({ message: "Unauthorized" });

    const support = await tokenFor("support");
    const forbidden = await as("get", "/lots", support);
    expect(forbidden.status).toBe(403);
    expect(forbidden.body).toEqual({ message: "Forbidden" });
  });
});
