process.env.JWT_SECRET = process.env.JWT_SECRET || "integration-test-secret";

const request = require("supertest");
const app = require("../app");
const sequelize = require("../database");
const Lot = require("../models/lot");
const Stock = require("../models/stock");
const { assertTestDatabase } = require("../../test/helpers/test-database");
const {
  as,
  createInboxLot,
  createReceivedPurchase,
  createReferences,
  resetInboxDatabase,
  tokenFor,
} = require("../../test/helpers/warehouse-inbox");

beforeAll(async () => {
  assertTestDatabase(sequelize.config.database);
  await sequelize.authenticate();
});

beforeEach(async () => {
  assertTestDatabase(sequelize.config.database);
  await resetInboxDatabase();
});

afterAll(async () => {
  await resetInboxDatabase();
  await sequelize.close();
});

describe("GET /warehouse-inbox/lots with a real database", () => {
  it("lists pending lots with product, item state and purchase data", async () => {
    const references = await createReferences();
    const pending = await createInboxLot(references, { stock: 100 });
    const { purchase, item } = await createReceivedPurchase(
      references,
      pending,
    );
    const token = await tokenFor("manager_warehouse");

    const response = await as(
      "get",
      `/warehouse-inbox/lots?product_id=${references.product.id}`,
      token,
    );

    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(1);
    expect(response.body[0]).toMatchObject({
      id: pending.id,
      number: pending.number,
      product_id: references.product.id,
      stock: 100,
      reserved: 0,
      available: 0,
      location_status: "pending",
      location_started_at: null,
      located_at: null,
      created_at: expect.any(String),
      product: {
        id: references.product.id,
        name: references.product.name,
        reference: references.product.reference,
      },
      item_state: {
        id: references.itemState.id,
        name: references.itemState.name,
        label: references.itemState.label,
      },
      purchase: {
        id: purchase.id,
        number: purchase.number,
        supplier_id: purchase.supplier_id,
      },
      purchase_item_id: item.id,
      started_by: null,
      located_by: null,
    });
  });

  it("filters by purchase, status and expiration and supports the product alias", async () => {
    const references = await createReferences();
    const pending = await createInboxLot(references, {
      expiration_date: "2027-01-31",
    });
    const located = await createInboxLot(references, {
      location_status: "located",
      expiration_date: "2027-02-28",
    });
    const { purchase } = await createReceivedPurchase(references, pending);
    const token = await tokenFor("seller");

    const byPurchase = await as(
      "get",
      `/warehouse-inbox/lots?purchase_id=${purchase.id}`,
      token,
    );
    expect(byPurchase.status).toBe(200);
    expect(byPurchase.body.map((row) => row.id)).toEqual([pending.id]);

    const all = await as("get", "/warehouse-inbox/lots?status=all", token);
    expect(all.body.map((row) => row.id)).toEqual(
      expect.arrayContaining([pending.id, located.id]),
    );

    const before = await as(
      "get",
      "/warehouse-inbox/lots?expiring_before=2027-01-31",
      token,
    );
    expect(before.body.map((row) => row.id)).toEqual([pending.id]);

    const alias = await as(
      "get",
      `/warehouse-inbox/products/${references.product.id}/lots`,
      token,
    );
    expect(alias.status).toBe(200);
    expect(alias.body.map((row) => row.id)).toEqual([pending.id]);
  });

  it("validates filters and roles", async () => {
    const token = await tokenFor("admin");

    const invalid = await as(
      "get",
      "/warehouse-inbox/lots?status=unknown",
      token,
    );
    expect(invalid.status).toBe(422);

    const dispatcher = await tokenFor("dispatcher");
    const forbidden = await as("get", "/warehouse-inbox/lots", dispatcher);
    expect(forbidden.status).toBe(403);

    const anonymous = await request(app).get("/warehouse-inbox/lots");
    expect(anonymous.status).toBe(401);
  });
});
