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
describe("POST /lots with a real database", () => {
  it("creates a lot with its relations and available", async () => {
    const references = await createReferences();
    const token = await tokenFor("admin");
    const body = lotBody(references, { number: " l-2026-001 " });

    const response = await as("post", "/lots", token).send(body);

    expect(response.status).toBe(201);
    expect(response.body).toEqual({
      id: expect.any(Number),
      number: "l-2026-001",
      product_id: references.product.id,
      expiration_date: "2027-03-31",
      item_state_id: references.itemState.id,
      stock: 120,
      reserved: 15,
      available: 105,
      warehouse_id: references.warehouse.id,
      shelf_id: references.shelf.id,
      section_id: references.section.id,
      product: {
        id: references.product.id,
        name: "Ibuprofeno 400 mg",
        reference: "IBU-400",
      },
      item_state: {
        id: references.itemState.id,
        name: references.itemState.name,
        label: "Vendible",
        is_sellable: false,
      },
      warehouse: {
        id: references.warehouse.id,
        name: references.warehouse.name,
      },
      shelf: {
        id: references.shelf.id,
        code: references.shelf.code,
        name: null,
      },
      section: {
        id: references.section.id,
        code: references.section.code,
        name: null,
      },
    });
    expect(response.body).not.toHaveProperty("createdAt");
    expect(response.body).not.toHaveProperty("updatedAt");

    const stored = await Lot.findByPk(response.body.id);
    expect(stored.number).toBe("l-2026-001");
  });

  it("defaults stock and reserved to zero", async () => {
    const references = await createReferences();
    const token = await tokenFor("seller");
    const { stock, reserved, ...body } = lotBody(references);

    const response = await as("post", "/lots", token).send(body);

    expect(response.status).toBe(201);
    expect(response.body.stock).toBe(0);
    expect(response.body.reserved).toBe(0);
    expect(response.body.available).toBe(0);
  });

  it("rejects a duplicated number for the same product ignoring case", async () => {
    const references = await createReferences();
    await createLot(references, { number: "L-2026-001" });
    const token = await tokenFor("manager_warehouse");

    const response = await as("post", "/lots", token).send(
      lotBody(references, { number: "l-2026-001" }),
    );

    expect(response.status).toBe(409);
    expect(response.body).toEqual({ message: "Lot already exists" });
  });

  it("allows the same number for another product", async () => {
    const first = await createReferences();
    const second = await createReferences({
      productData: { reference: "PAR-500", name: "Paracetamol 500 mg" },
    });
    await createLot(first, { number: "L-SHARED" });
    const token = await tokenFor("admin");

    const response = await as("post", "/lots", token).send(
      lotBody(second, { number: "L-SHARED" }),
    );

    expect(response.status).toBe(201);
  });

  it("responds 400 when required fields are missing", async () => {
    const token = await tokenFor("admin");

    const response = await as("post", "/lots", token).send({});

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      message:
        "number, product_id, expiration_date, item_state_id, warehouse_id, shelf_id and section_id are required",
    });
  });

  it.each([
    ["2026-02-30", "expiration_date"],
    ["2027-03-31", "reserved"],
  ])("responds 422 for invalid %s", async (value, field) => {
    const references = await createReferences();
    const token = await tokenFor("admin");
    const body =
      field === "expiration_date"
        ? lotBody(references, { expiration_date: value })
        : lotBody(references, { stock: 10, reserved: 11 });

    const response = await as("post", "/lots", token).send(body);

    expect(response.status).toBe(422);
    expect(response.body.errors).toHaveProperty(field);
  });

  it("responds 422 for an unknown reference", async () => {
    const references = await createReferences();
    const token = await tokenFor("admin");

    const response = await as("post", "/lots", token).send(
      lotBody(references, { product_id: 99999 }),
    );

    expect(response.status).toBe(422);
    expect(response.body).toEqual({
      errors: { product_id: "Invalid product id" },
    });
  });

  it("rejects a shelf from another warehouse and a section from another shelf", async () => {
    const references = await createReferences();
    const other = await createReferences({
      productData: { reference: "OTHER-1", name: "Otro" },
    });
    const token = await tokenFor("admin");

    const wrongShelf = await as("post", "/lots", token).send(
      lotBody(references, { warehouse_id: other.warehouse.id }),
    );
    expect(wrongShelf.status).toBe(422);
    expect(wrongShelf.body).toEqual({
      errors: { shelf_id: "Shelf does not belong to the warehouse" },
    });

    const sameWarehouseShelf = await createShelf(references.warehouse.id);
    const wrongSection = await as("post", "/lots", token).send(
      lotBody(references, { shelf_id: sameWarehouseShelf.id }),
    );
    expect(wrongSection.status).toBe(422);
    expect(wrongSection.body).toEqual({
      errors: { section_id: "Section does not belong to the shelf" },
    });
  });

  it("protects the references with RESTRICT foreign keys", async () => {
    const references = await createReferences();
    const lot = await createLot(references);

    await expect(references.product.destroy()).rejects.toThrow();
    await expect(references.itemState.destroy()).rejects.toThrow();
    await expect(references.warehouse.destroy()).rejects.toThrow();
    await expect(references.shelf.destroy()).rejects.toThrow();
    await expect(references.section.destroy()).rejects.toThrow();
    await expect(Lot.findByPk(lot.id)).resolves.not.toBeNull();
  });
});
