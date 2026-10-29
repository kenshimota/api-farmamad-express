process.env.JWT_SECRET = process.env.JWT_SECRET || "integration-test-secret";

const sequelize = require("../database");
const Warehouse = require("../models/warehouse");
const { assertTestDatabase } = require("../../test/helpers/test-database");
const {
  BODY,
  PUBLIC_WAREHOUSE,
  as,
  createWarehouse,
  resetDatabase,
  tokenFor,
} = require("../../test/helpers/warehouses");

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

describe("GET /warehouses/:id with a real database", () => {
  it("returns one warehouse for the allowed roles", async () => {
    const warehouse = await createWarehouse();
    const token = await tokenFor("dispatcher");

    const response = await as("get", `/warehouses/${warehouse.id}`, token);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ ...PUBLIC_WAREHOUSE, id: warehouse.id });
  });

  it("responds 404 and 422 for unknown and invalid ids", async () => {
    const token = await tokenFor("admin");

    const missing = await as("get", "/warehouses/99999", token);
    expect(missing.status).toBe(404);
    expect(missing.body).toEqual({ message: "Warehouse not found" });

    const invalid = await as("get", "/warehouses/abc", token);
    expect(invalid.status).toBe(422);
    expect(invalid.body).toEqual({
      errors: { id: "Invalid warehouse id" },
    });
  });
});

describe("PUT /warehouses/:id with a real database", () => {
  it("updates name and address and keeps observations when omitted", async () => {
    const warehouse = await createWarehouse();
    const token = await tokenFor("manager_warehouse");

    const response = await as("put", `/warehouses/${warehouse.id}`, token).send(
      {
        name: "Bodega Sur",
        address: "Calle 3 #10",
      },
    );

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      id: warehouse.id,
      name: "Bodega Sur",
      observations: BODY.observations,
      address: "Calle 3 #10",
    });

    const stored = await Warehouse.findByPk(warehouse.id);
    expect(stored.observations).toBe(BODY.observations);
  });

  it("updates observations when it is sent, including null", async () => {
    const warehouse = await createWarehouse();
    const token = await tokenFor("admin");

    const response = await as("put", `/warehouses/${warehouse.id}`, token).send(
      {
        name: "Bodega Central",
        observations: null,
        address: "Av. Monseñor Rivero 123",
      },
    );

    expect(response.status).toBe(200);
    expect(response.body.observations).toBeNull();
  });

  it("responds 404 and 422 for unknown and invalid ids", async () => {
    const token = await tokenFor("admin");

    const missing = await as("put", "/warehouses/99999", token).send(BODY);
    expect(missing.status).toBe(404);
    expect(missing.body).toEqual({ message: "Warehouse not found" });

    const invalid = await as("put", "/warehouses/0", token).send(BODY);
    expect(invalid.status).toBe(422);
    expect(invalid.body).toEqual({
      errors: { id: "Invalid warehouse id" },
    });
  });

  it("responds 403 for a dispatcher user", async () => {
    const warehouse = await createWarehouse();
    const token = await tokenFor("dispatcher");

    const response = await as("put", `/warehouses/${warehouse.id}`, token).send(
      BODY,
    );

    expect(response.status).toBe(403);
    expect(response.body).toEqual({ message: "Forbidden" });
  });
});

describe("DELETE /warehouses/:id with a real database", () => {
  it("deletes the warehouse and answers 204 without body", async () => {
    const warehouse = await createWarehouse();
    const token = await tokenFor("manager_warehouse");

    const response = await as("delete", `/warehouses/${warehouse.id}`, token);

    expect(response.status).toBe(204);
    expect(response.text).toBe("");
    await expect(Warehouse.findByPk(warehouse.id)).resolves.toBeNull();
  });

  it("responds 404 and 422 for unknown and invalid ids", async () => {
    const token = await tokenFor("admin");

    const missing = await as("delete", "/warehouses/99999", token);
    expect(missing.status).toBe(404);
    expect(missing.body).toEqual({ message: "Warehouse not found" });

    const invalid = await as("delete", "/warehouses/abc", token);
    expect(invalid.status).toBe(422);
    expect(invalid.body).toEqual({
      errors: { id: "Invalid warehouse id" },
    });
  });

  it("responds 403 for a dispatcher user", async () => {
    const warehouse = await createWarehouse();
    const token = await tokenFor("dispatcher");

    const response = await as("delete", `/warehouses/${warehouse.id}`, token);

    expect(response.status).toBe(403);
    expect(response.body).toEqual({ message: "Forbidden" });
  });
});
