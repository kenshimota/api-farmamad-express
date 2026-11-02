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

describe("start and location with a real database", () => {
  it("moves pending to in_progress and prevents another user", async () => {
    const references = await createReferences();
    const pending = await createInboxLot(references);
    const manager = await tokenFor("manager_warehouse");
    const admin = await tokenFor("admin");

    const started = await as(
      "post",
      `/warehouse-inbox/lots/${pending.id}/start`,
      manager,
    );
    expect(started.status).toBe(200);
    expect(started.body).toMatchObject({
      id: pending.id,
      location_status: "in_progress",
      location_started_at: expect.any(String),
      location_started_by: expect.any(Number),
      started_by: { id: expect.any(Number), username: "luis" },
    });

    const again = await as(
      "post",
      `/warehouse-inbox/lots/${pending.id}/start`,
      manager,
    );
    expect(again.status).toBe(200);

    const other = await as(
      "post",
      `/warehouse-inbox/lots/${pending.id}/start`,
      admin,
    );
    expect(other.status).toBe(409);
    expect(other.body).toEqual({
      message: "Lot is being located by another user",
    });
  });

  it("assigns the location, keeps the audit and exposes available stock", async () => {
    const references = await createReferences({
      itemStateData: { is_sellable: true },
    });
    const pending = await createInboxLot(references, { stock: 100 });
    await Stock.create({
      product_id: references.product.id,
      item_state_id: references.itemState.id,
      quantity: 100,
    });
    const manager = await tokenFor("manager_warehouse");

    await as("post", `/warehouse-inbox/lots/${pending.id}/start`, manager);

    const response = await as(
      "put",
      `/warehouse-inbox/lots/${pending.id}/location`,
      manager,
    ).send({
      warehouse_id: references.warehouse.id,
      shelf_id: references.shelf.id,
      section_id: references.section.id,
    });

    expect(response.status).toBe(202);
    expect(response.body).toMatchObject({
      id: pending.id,
      stock: 100,
      reserved: 0,
      available: 100,
      location_status: "located",
      warehouse_id: references.warehouse.id,
      shelf_id: references.shelf.id,
      section_id: references.section.id,
      located_at: expect.any(String),
      located_by: expect.any(Number),
    });

    const stored = await Lot.findByPk(pending.id);
    expect(stored.location_started_at).toBeInstanceOf(Date);
    expect(stored.location_started_by).toEqual(expect.any(Number));

    const inbox = await as("get", "/warehouse-inbox/lots", manager);
    expect(inbox.body.map((row) => row.id)).not.toContain(pending.id);

    const locatedFilter = await as(
      "get",
      "/warehouse-inbox/lots?status=located",
      manager,
    );
    expect(locatedFilter.body.map((row) => row.id)).toContain(pending.id);

    const stocks = await as(
      "get",
      `/stocks/available?product_id=${references.product.id}`,
      manager,
    );
    expect(stocks.body[0]).toMatchObject({
      quantity: 100,
      located_quantity: 100,
    });
  });

  it("rejects incoherent locations and a second location", async () => {
    const references = await createReferences();
    const other = await createReferences({
      productData: { reference: "INBOX-OTHER", name: "Otro" },
    });
    const pending = await createInboxLot(references);
    const manager = await tokenFor("manager_warehouse");
    const body = {
      warehouse_id: references.warehouse.id,
      shelf_id: references.shelf.id,
      section_id: references.section.id,
    };

    const wrongShelf = await as(
      "put",
      `/warehouse-inbox/lots/${pending.id}/location`,
      manager,
    ).send({ ...body, warehouse_id: other.warehouse.id });
    expect(wrongShelf.status).toBe(422);
    expect(wrongShelf.body).toEqual({
      errors: { shelf_id: "Shelf does not belong to the warehouse" },
    });

    const located = await as(
      "put",
      `/warehouse-inbox/lots/${pending.id}/location`,
      manager,
    ).send(body);
    expect(located.status).toBe(202);

    const twice = await as(
      "put",
      `/warehouse-inbox/lots/${pending.id}/location`,
      manager,
    ).send(body);
    expect(twice.status).toBe(409);
    expect(twice.body).toEqual({ message: "Lot is already located" });

    const missing = await as(
      "post",
      "/warehouse-inbox/lots/99999/start",
      manager,
    );
    expect(missing.status).toBe(404);
  });

  it("allows only admin and manager_warehouse to write", async () => {
    const references = await createReferences();
    const pending = await createInboxLot(references);
    const seller = await tokenFor("seller");

    const start = await as(
      "post",
      `/warehouse-inbox/lots/${pending.id}/start`,
      seller,
    );
    expect(start.status).toBe(403);

    const location = await as(
      "put",
      `/warehouse-inbox/lots/${pending.id}/location`,
      seller,
    ).send({
      warehouse_id: references.warehouse.id,
      shelf_id: references.shelf.id,
      section_id: references.section.id,
    });
    expect(location.status).toBe(403);

    const missingBody = await as(
      "put",
      `/warehouse-inbox/lots/${pending.id}/location`,
      await tokenFor("admin"),
    ).send({});
    expect(missingBody.status).toBe(400);
    expect(missingBody.body).toEqual({
      message: "warehouse_id, shelf_id and section_id are required",
    });
  });
});
