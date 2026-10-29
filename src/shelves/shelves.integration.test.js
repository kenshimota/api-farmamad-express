process.env.JWT_SECRET = process.env.JWT_SECRET || "integration-test-secret";

const request = require("supertest");
const { ForeignKeyConstraintError } = require("sequelize");
const app = require("../app");
const sequelize = require("../database");
const Shelf = require("../models/shelf");
const ShelfSection = require("../models/shelf-section");
const { assertTestDatabase } = require("../../test/helpers/test-database");
const {
  as,
  createSection,
  createShelf,
  createWarehouse,
  resetDatabase,
  tokenFor,
} = require("../../test/helpers/shelves");

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

describe("POST and GET /shelves with a real database", () => {
  it("creates a shelf, normalizes the code and starts with no sections", async () => {
    const warehouse = await createWarehouse();
    const token = await tokenFor("admin");

    const response = await as("post", "/shelves", token).send({
      warehouse_id: warehouse.id,
      code: " a1 ",
      name: "Estante A1",
      description: "Pasillo principal",
    });

    expect(response.status).toBe(201);
    expect(response.body).toEqual({
      id: expect.any(Number),
      warehouse_id: warehouse.id,
      code: "A1",
      name: "Estante A1",
      description: "Pasillo principal",
      sections: [],
    });
    expect(response.body).not.toHaveProperty("createdAt");
    expect(response.body).not.toHaveProperty("updatedAt");

    const stored = await Shelf.findByPk(response.body.id);
    expect(stored.code).toBe("A1");
  });

  it("rejects a duplicated code ignoring case inside the same warehouse", async () => {
    const warehouse = await createWarehouse();
    await createShelf(warehouse.id, { code: "A1" });
    const token = await tokenFor("manager_warehouse");

    const response = await as("post", "/shelves", token).send({
      warehouse_id: warehouse.id,
      code: "a1",
    });

    expect(response.status).toBe(409);
    expect(response.body).toEqual({ message: "Shelf already exists" });
  });

  it("allows the same code in another warehouse", async () => {
    const first = await createWarehouse({ name: "Bodega 1" });
    const second = await createWarehouse({ name: "Bodega 2" });
    await createShelf(first.id, { code: "A1" });
    const token = await tokenFor("admin");

    const response = await as("post", "/shelves", token).send({
      warehouse_id: second.id,
      code: "A1",
    });

    expect(response.status).toBe(201);
    expect(response.body.code).toBe("A1");
  });

  it("responds 422 for an unknown warehouse and the FK protects the rows", async () => {
    const token = await tokenFor("admin");

    const response = await as("post", "/shelves", token).send({
      warehouse_id: 99999,
      code: "A1",
    });

    expect(response.status).toBe(422);
    expect(response.body).toEqual({
      errors: { warehouse_id: "Invalid warehouse id" },
    });
    await expect(
      Shelf.create({ warehouse_id: 99999, code: "B1" }),
    ).rejects.toThrow(ForeignKeyConstraintError);
  });

  it("lists by warehouse_id and code and includes ordered sections", async () => {
    const first = await createWarehouse({ name: "Bodega 1" });
    const second = await createWarehouse({ name: "Bodega 2" });
    const b2 = await createShelf(first.id, { code: "B2" });
    await createShelf(first.id, { code: "A1" });
    await createShelf(second.id, { code: "A0" });
    await createSection(b2.id, { code: "B2-02" });
    await createSection(b2.id, { code: "B2-01" });
    const token = await tokenFor("seller");

    const all = await as("get", "/shelves", token);
    expect(all.status).toBe(200);
    expect(all.body.map((row) => row.code)).toEqual(["A1", "B2", "A0"]);
    expect(all.body[0]).not.toHaveProperty("sections");

    const filtered = await as(
      "get",
      `/shelves?warehouse_id=${first.id}`,
      token,
    );
    expect(filtered.status).toBe(200);
    expect(filtered.body.map((row) => row.code)).toEqual(["A1", "B2"]);

    const included = await as(
      "get",
      `/shelves?warehouse_id=${first.id}&include=sections`,
      token,
    );
    expect(included.status).toBe(200);
    expect(included.body[1].sections.map((row) => row.code)).toEqual([
      "B2-01",
      "B2-02",
    ]);
  });

  it("returns the detail with its sections and validates the filters", async () => {
    const warehouse = await createWarehouse();
    const shelf = await createShelf(warehouse.id, { code: "A1" });
    await createSection(shelf.id, { code: "A1-02" });
    await createSection(shelf.id, { code: "A1-01" });
    const token = await tokenFor("dispatcher");

    const detail = await as("get", `/shelves/${shelf.id}`, token);
    expect(detail.status).toBe(200);
    expect(detail.body.sections.map((row) => row.code)).toEqual([
      "A1-01",
      "A1-02",
    ]);

    const invalidFilter = await as("get", "/shelves?warehouse_id=abc", token);
    expect(invalidFilter.status).toBe(422);

    const invalidInclude = await as("get", "/shelves?include=state", token);
    expect(invalidInclude.status).toBe(422);

    const missing = await as("get", "/shelves/99999", token);
    expect(missing.status).toBe(404);
    expect(missing.body).toEqual({ message: "Shelf not found" });
  });
});

describe("PUT and DELETE /shelves with a real database", () => {
  it("updates the editable fields and answers 202", async () => {
    const warehouse = await createWarehouse();
    const shelf = await createShelf(warehouse.id, { code: "A1" });
    const token = await tokenFor("admin");

    const response = await as("put", `/shelves/${shelf.id}`, token).send({
      code: "b2",
      name: "Estante B2",
      description: "Lado izquierdo",
    });

    expect(response.status).toBe(202);
    expect(response.body).toEqual(
      expect.objectContaining({
        id: shelf.id,
        warehouse_id: warehouse.id,
        code: "B2",
        name: "Estante B2",
        description: "Lado izquierdo",
      }),
    );

    const stored = await Shelf.findByPk(shelf.id);
    expect(stored.code).toBe("B2");
  });

  it("keeps warehouse_id immutable and enforces uniqueness on update", async () => {
    const first = await createWarehouse({ name: "Bodega 1" });
    const second = await createWarehouse({ name: "Bodega 2" });
    const shelf = await createShelf(first.id, { code: "A1" });
    await createShelf(first.id, { code: "B2" });
    const token = await tokenFor("admin");

    const immutable = await as("put", `/shelves/${shelf.id}`, token).send({
      warehouse_id: second.id,
    });
    expect(immutable.status).toBe(422);
    expect(immutable.body).toEqual({
      errors: { warehouse_id: "warehouse_id cannot be changed" },
    });

    const duplicate = await as("put", `/shelves/${shelf.id}`, token).send({
      code: "b2",
    });
    expect(duplicate.status).toBe(409);
    expect(duplicate.body).toEqual({ message: "Shelf already exists" });

    const unchanged = await Shelf.findByPk(shelf.id);
    expect(unchanged.warehouse_id).toBe(first.id);
  });

  it("deletes the shelf and its sections in cascade", async () => {
    const warehouse = await createWarehouse();
    const shelf = await createShelf(warehouse.id, { code: "A1" });
    const section = await createSection(shelf.id, { code: "A1-01" });
    const token = await tokenFor("manager_warehouse");

    const response = await as("delete", `/shelves/${shelf.id}`, token);

    expect(response.status).toBe(204);
    expect(response.text).toBe("");
    await expect(Shelf.findByPk(shelf.id)).resolves.toBeNull();
    await expect(ShelfSection.findByPk(section.id)).resolves.toBeNull();
  });

  it("protects a warehouse that still has shelves", async () => {
    const warehouse = await createWarehouse();
    await createShelf(warehouse.id);

    await expect(warehouse.destroy()).rejects.toThrow(
      ForeignKeyConstraintError,
    );
  });

  it("responds 401 and 403 for unauthorized roles", async () => {
    const warehouse = await createWarehouse();
    const shelf = await createShelf(warehouse.id);
    const seller = await tokenFor("seller");

    const anonymous = await request(app).get("/shelves");
    expect(anonymous.status).toBe(401);

    const forbidden = await as("delete", `/shelves/${shelf.id}`, seller);
    expect(forbidden.status).toBe(403);
    expect(forbidden.body).toEqual({ message: "Forbidden" });
  });
});
