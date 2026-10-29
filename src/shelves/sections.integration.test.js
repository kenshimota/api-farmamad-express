process.env.JWT_SECRET = process.env.JWT_SECRET || "integration-test-secret";

const request = require("supertest");
const app = require("../app");
const sequelize = require("../database");
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

describe("POST and GET /shelves/:shelf_id/sections with a real database", () => {
  it("creates a section and normalizes the code", async () => {
    const warehouse = await createWarehouse();
    const shelf = await createShelf(warehouse.id, { code: "A1" });
    const token = await tokenFor("admin");

    const response = await as(
      "post",
      `/shelves/${shelf.id}/sections`,
      token,
    ).send({ code: " a1-03 ", name: "Nivel 3" });

    expect(response.status).toBe(201);
    expect(response.body).toEqual({
      id: expect.any(Number),
      shelf_id: shelf.id,
      code: "A1-03",
      name: "Nivel 3",
      description: null,
    });
    expect(response.body).not.toHaveProperty("createdAt");

    const stored = await ShelfSection.findByPk(response.body.id);
    expect(stored.code).toBe("A1-03");
  });

  it("is unique per shelf ignoring case and allows the code in another shelf", async () => {
    const warehouse = await createWarehouse();
    const first = await createShelf(warehouse.id, { code: "A1" });
    const second = await createShelf(warehouse.id, { code: "A2" });
    await createSection(first.id, { code: "A1-01" });
    const token = await tokenFor("admin");

    const duplicate = await as(
      "post",
      `/shelves/${first.id}/sections`,
      token,
    ).send({ code: "a1-01" });
    expect(duplicate.status).toBe(409);
    expect(duplicate.body).toEqual({ message: "Section already exists" });

    const other = await as(
      "post",
      `/shelves/${second.id}/sections`,
      token,
    ).send({ code: "A1-01" });
    expect(other.status).toBe(201);
  });

  it("lists and reads sections scoped to the shelf", async () => {
    const warehouse = await createWarehouse();
    const first = await createShelf(warehouse.id, { code: "A1" });
    const second = await createShelf(warehouse.id, { code: "A2" });
    const section = await createSection(first.id, { code: "A1-02" });
    await createSection(first.id, { code: "A1-01" });
    const foreign = await createSection(second.id, { code: "A2-01" });
    const token = await tokenFor("dispatcher");

    const list = await as("get", `/shelves/${first.id}/sections`, token);
    expect(list.status).toBe(200);
    expect(list.body.map((row) => row.code)).toEqual(["A1-01", "A1-02"]);

    const detail = await as(
      "get",
      `/shelves/${first.id}/sections/${section.id}`,
      token,
    );
    expect(detail.status).toBe(200);
    expect(detail.body.code).toBe("A1-02");

    const wrongShelf = await as(
      "get",
      `/shelves/${first.id}/sections/${foreign.id}`,
      token,
    );
    expect(wrongShelf.status).toBe(404);
    expect(wrongShelf.body).toEqual({ message: "Section not found" });
  });

  it("responds 404 for an unknown shelf and 422 for invalid ids", async () => {
    const warehouse = await createWarehouse();
    const shelf = await createShelf(warehouse.id, { code: "A1" });
    const token = await tokenFor("admin");

    const unknown = await as("get", "/shelves/99999/sections", token);
    expect(unknown.status).toBe(404);
    expect(unknown.body).toEqual({ message: "Shelf not found" });

    const invalidShelf = await as("get", "/shelves/abc/sections", token);
    expect(invalidShelf.status).toBe(422);
    expect(invalidShelf.body).toEqual({
      errors: { shelf_id: "Invalid shelf id" },
    });

    const invalidSection = await as(
      "get",
      `/shelves/${shelf.id}/sections/abc`,
      token,
    );
    expect(invalidSection.status).toBe(422);
    expect(invalidSection.body).toEqual({
      errors: { section_id: "Invalid section id" },
    });
  });
});

describe("PUT and DELETE /shelves/:shelf_id/sections with a real database", () => {
  it("updates the editable fields and answers 202", async () => {
    const warehouse = await createWarehouse();
    const shelf = await createShelf(warehouse.id, { code: "A1" });
    const section = await createSection(shelf.id, { code: "A1-01" });
    const token = await tokenFor("manager_warehouse");

    const response = await as(
      "put",
      `/shelves/${shelf.id}/sections/${section.id}`,
      token,
    ).send({ code: "a1-02", name: "Nivel 2", description: "Lado izquierdo" });

    expect(response.status).toBe(202);
    expect(response.body).toEqual({
      id: section.id,
      shelf_id: shelf.id,
      code: "A1-02",
      name: "Nivel 2",
      description: "Lado izquierdo",
    });
  });

  it("keeps shelf_id immutable and scopes the update to the shelf", async () => {
    const warehouse = await createWarehouse();
    const first = await createShelf(warehouse.id, { code: "A1" });
    const second = await createShelf(warehouse.id, { code: "A2" });
    const section = await createSection(first.id, { code: "A1-01" });
    const foreign = await createSection(second.id, { code: "A2-01" });
    const token = await tokenFor("admin");

    const immutable = await as(
      "put",
      `/shelves/${first.id}/sections/${section.id}`,
      token,
    ).send({ shelf_id: second.id });
    expect(immutable.status).toBe(422);
    expect(immutable.body).toEqual({
      errors: { shelf_id: "shelf_id cannot be changed" },
    });

    const wrongShelf = await as(
      "put",
      `/shelves/${first.id}/sections/${foreign.id}`,
      token,
    ).send({ code: "A2-99" });
    expect(wrongShelf.status).toBe(404);
    expect(wrongShelf.body).toEqual({ message: "Section not found" });
  });

  it("rejects a duplicated code on update", async () => {
    const warehouse = await createWarehouse();
    const shelf = await createShelf(warehouse.id, { code: "A1" });
    const first = await createSection(shelf.id, { code: "A1-01" });
    await createSection(shelf.id, { code: "A1-02" });
    const token = await tokenFor("admin");

    const response = await as(
      "put",
      `/shelves/${shelf.id}/sections/${first.id}`,
      token,
    ).send({ code: "a1-02" });

    expect(response.status).toBe(409);
    expect(response.body).toEqual({ message: "Section already exists" });
  });

  it("deletes a section and answers 204", async () => {
    const warehouse = await createWarehouse();
    const shelf = await createShelf(warehouse.id, { code: "A1" });
    const section = await createSection(shelf.id, { code: "A1-01" });
    const token = await tokenFor("admin");

    const response = await as(
      "delete",
      `/shelves/${shelf.id}/sections/${section.id}`,
      token,
    );

    expect(response.status).toBe(204);
    expect(response.text).toBe("");
    await expect(ShelfSection.findByPk(section.id)).resolves.toBeNull();
  });

  it("responds 401 and 403 for unauthorized roles", async () => {
    const warehouse = await createWarehouse();
    const shelf = await createShelf(warehouse.id, { code: "A1" });
    const section = await createSection(shelf.id, { code: "A1-01" });
    const seller = await tokenFor("seller");

    const anonymous = await request(app).get(`/shelves/${shelf.id}/sections`);
    expect(anonymous.status).toBe(401);

    const forbidden = await as(
      "delete",
      `/shelves/${shelf.id}/sections/${section.id}`,
      seller,
    );
    expect(forbidden.status).toBe(403);
    expect(forbidden.body).toEqual({ message: "Forbidden" });
  });
});
