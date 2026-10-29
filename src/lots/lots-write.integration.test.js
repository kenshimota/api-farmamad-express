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

describe("PUT /lots/:id with a real database", () => {
  it("replaces the editable fields and answers 202 with available", async () => {
    const references = await createReferences();
    const lot = await createLot(references, {
      number: "L-UPDATE-1",
      stock: 120,
      reserved: 15,
    });
    const token = await tokenFor("admin");

    const response = await as("put", `/lots/${lot.id}`, token).send(
      lotBody(references, {
        number: " L-UPDATE-1 ",
        stock: 100,
        reserved: 10,
        expiration_date: "2028-01-31",
      }),
    );

    expect(response.status).toBe(202);
    expect(response.body).toEqual(
      expect.objectContaining({
        id: lot.id,
        number: "L-UPDATE-1",
        expiration_date: "2028-01-31",
        stock: 100,
        reserved: 10,
        available: 90,
      }),
    );

    const stored = await Lot.findByPk(lot.id);
    expect(stored.stock).toBe(100);
    expect(stored.reserved).toBe(10);
  });

  it("responds 400 when a required field is missing", async () => {
    const references = await createReferences();
    const lot = await createLot(references);
    const token = await tokenFor("admin");
    const { reserved, ...body } = lotBody(references);

    const response = await as("put", `/lots/${lot.id}`, token).send(body);

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      message:
        "number, product_id, expiration_date, item_state_id, stock, reserved, warehouse_id, shelf_id and section_id are required",
    });
  });

  it("responds 422 when reserved exceeds stock", async () => {
    const references = await createReferences();
    const lot = await createLot(references);
    const token = await tokenFor("admin");

    const response = await as("put", `/lots/${lot.id}`, token).send(
      lotBody(references, { stock: 5, reserved: 6 }),
    );

    expect(response.status).toBe(422);
    expect(response.body).toEqual({
      errors: { reserved: "reserved cannot exceed stock" },
    });
  });

  it("rejects a duplicated pair ignoring case", async () => {
    const references = await createReferences();
    const first = await createLot(references, { number: "L-DUP-1" });
    await createLot(references, { number: "L-DUP-2" });
    const token = await tokenFor("seller");

    const response = await as("put", `/lots/${first.id}`, token).send(
      lotBody(references, { number: "l-dup-2" }),
    );

    expect(response.status).toBe(409);
    expect(response.body).toEqual({ message: "Lot already exists" });
  });

  it("revalidates the location coherence", async () => {
    const references = await createReferences();
    const other = await createReferences({
      productData: { reference: "OTHER-3", name: "Otro" },
    });
    const lot = await createLot(references);
    const token = await tokenFor("manager_warehouse");

    const wrongShelf = await as("put", `/lots/${lot.id}`, token).send(
      lotBody(references, { warehouse_id: other.warehouse.id }),
    );
    expect(wrongShelf.status).toBe(422);
    expect(wrongShelf.body).toEqual({
      errors: { shelf_id: "Shelf does not belong to the warehouse" },
    });

    const sameWarehouseShelf = await createShelf(references.warehouse.id);
    const wrongSection = await as("put", `/lots/${lot.id}`, token).send(
      lotBody(references, { shelf_id: sameWarehouseShelf.id }),
    );
    expect(wrongSection.status).toBe(422);
    expect(wrongSection.body).toEqual({
      errors: { section_id: "Section does not belong to the shelf" },
    });
  });

  it("responds 404 for an unknown lot and 422 for an invalid id", async () => {
    const references = await createReferences();
    const token = await tokenFor("admin");

    const missing = await as("put", "/lots/99999", token).send(
      lotBody(references),
    );
    expect(missing.status).toBe(404);
    expect(missing.body).toEqual({ message: "Lot not found" });

    const invalid = await as("put", "/lots/abc", token).send(
      lotBody(references),
    );
    expect(invalid.status).toBe(422);
    expect(invalid.body).toEqual({ errors: { id: "Invalid lot id" } });
  });
});

describe("DELETE /lots/:id with a real database", () => {
  it("deletes a lot without quantities and answers 204", async () => {
    const references = await createReferences();
    const lot = await createLot(references, { stock: 0, reserved: 0 });
    const token = await tokenFor("admin");

    const response = await as("delete", `/lots/${lot.id}`, token);

    expect(response.status).toBe(204);
    expect(response.text).toBe("");
    await expect(Lot.findByPk(lot.id)).resolves.toBeNull();
  });

  it.each([
    [{ stock: 1, reserved: 0 }],
    [{ stock: 5, reserved: 1 }],
    [{ stock: 10, reserved: 5 }],
  ])("responds 409 when the lot has quantities: %p", async (quantities) => {
    const references = await createReferences();
    const lot = await createLot(references, quantities);
    const token = await tokenFor("seller");

    const response = await as("delete", `/lots/${lot.id}`, token);

    expect(response.status).toBe(409);
    expect(response.body).toEqual({
      message: "Lot has stock or reservations",
    });
    await expect(Lot.findByPk(lot.id)).resolves.not.toBeNull();
  });

  it("responds 404 for an unknown lot and 422 for an invalid id", async () => {
    const token = await tokenFor("admin");

    const missing = await as("delete", "/lots/99999", token);
    expect(missing.status).toBe(404);
    expect(missing.body).toEqual({ message: "Lot not found" });

    const invalid = await as("delete", "/lots/abc", token);
    expect(invalid.status).toBe(422);
    expect(invalid.body).toEqual({ errors: { id: "Invalid lot id" } });
  });
});

describe("lots roles and database constraints", () => {
  it("responds 401 and 403 for unauthorized roles", async () => {
    const references = await createReferences();
    const lot = await createLot(references);
    const dispatcher = await tokenFor("dispatcher");

    const anonymous = await request(app).get("/lots");
    expect(anonymous.status).toBe(401);

    const read = await as("get", "/lots", dispatcher);
    expect(read.status).toBe(200);

    const write = await as("delete", `/lots/${lot.id}`, dispatcher);
    expect(write.status).toBe(403);
    expect(write.body).toEqual({ message: "Forbidden" });

    const customer = await tokenFor("customer");
    const forbidden = await as("post", "/lots", customer).send(
      lotBody(references, { number: uniqueNumber() }),
    );
    expect(forbidden.status).toBe(403);
  });

  it("enforces the non-negative and reserved-within-stock checks", async () => {
    const references = await createReferences();

    await expect(
      createLot(references, { stock: -1, reserved: 0 }),
    ).rejects.toThrow();
    await expect(
      createLot(references, { stock: 1, reserved: -1 }),
    ).rejects.toThrow();
    await expect(
      createLot(references, { stock: 1, reserved: 2 }),
    ).rejects.toThrow();
  });

  it("enforces the case-insensitive unique number per product", async () => {
    const references = await createReferences();
    await createLot(references, { number: "L-UNIQUE-1" });

    await expect(
      createLot(references, { number: "l-unique-1" }),
    ).rejects.toThrow();
  });
});
