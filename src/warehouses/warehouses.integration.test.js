process.env.JWT_SECRET = process.env.JWT_SECRET || "integration-test-secret";

const request = require("supertest");
const app = require("../app");
const sequelize = require("../database");
const User = require("../models/user");
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

describe("POST /warehouses with a real database", () => {
  it.each(["admin", "manager_warehouse"])(
    "allows a %s to create a warehouse and answers 201",
    async (role) => {
      const token = await tokenFor(role);

      const response = await as("post", "/warehouses", token).send(BODY);

      expect(response.status).toBe(201);
      expect(response.body).toEqual(PUBLIC_WAREHOUSE);
      expect(response.body).not.toHaveProperty("createdAt");
      expect(response.body).not.toHaveProperty("updatedAt");

      const stored = await Warehouse.findByPk(response.body.id);
      expect(stored.name).toBe(BODY.name);
      expect(stored.observations).toBe(BODY.observations);
      expect(stored.address).toBe(BODY.address);
    },
  );

  it("stores NULL when observations is omitted or null", async () => {
    const token = await tokenFor("admin");

    const omitted = await as("post", "/warehouses", token).send({
      name: "Bodega Norte",
      address: "Calle 2 #45",
    });

    expect(omitted.status).toBe(201);
    expect(omitted.body.observations).toBeNull();

    const explicitNull = await as("post", "/warehouses", token).send({
      name: "Bodega Sur",
      observations: null,
      address: "Calle 3 #10",
    });

    expect(explicitNull.status).toBe(201);
    expect(explicitNull.body.observations).toBeNull();
  });

  it("discards unknown and audit fields", async () => {
    const token = await tokenFor("admin");

    const response = await as("post", "/warehouses", token).send({
      ...BODY,
      id: 99,
      createdAt: "2026-09-01",
      updatedAt: "2026-09-01",
      admin: true,
    });

    expect(response.status).toBe(201);
    expect(response.body).not.toHaveProperty("createdAt");
    expect(response.body.id).not.toBe(99);
  });

  it("responds 401 without a token", async () => {
    const response = await request(app).post("/warehouses").send(BODY);

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ message: "Unauthorized" });
  });

  it.each(["seller", "dispatcher", "support", "customer"])(
    "responds 403 for a %s",
    async (role) => {
      const token = await tokenFor(role);

      const response = await as("post", "/warehouses", token).send(BODY);

      expect(response.status).toBe(403);
      expect(response.body).toEqual({ message: "Forbidden" });
    },
  );

  it("responds 400 and 422 for missing and invalid fields", async () => {
    const token = await tokenFor("admin");

    const missing = await as("post", "/warehouses", token).send({
      name: "Bodega Central",
    });
    expect(missing.status).toBe(400);
    expect(missing.body).toEqual({
      message: "name and address are required",
    });

    const invalid = await as("post", "/warehouses", token).send({
      name: "   ",
      address: "Av. Monseñor Rivero 123",
    });
    expect(invalid.status).toBe(422);
    expect(invalid.body).toEqual({
      errors: { name: "Nombre inválido" },
    });
  });

  it("responds 403 for a blocked user", async () => {
    const token = await tokenFor("admin");
    await User.update({ isBlocked: true }, { where: { username: "admin" } });

    const response = await as("get", "/warehouses", token);

    expect(response.status).toBe(403);
    expect(response.body).toEqual({ message: "User is blocked" });
  });
});

describe("GET /warehouses with a real database", () => {
  it("returns the warehouses ordered by id with public fields", async () => {
    const first = await createWarehouse();
    const second = await createWarehouse({
      name: "Bodega Norte",
      observations: null,
      address: "Calle 2 #45",
    });
    const token = await tokenFor("dispatcher");

    const response = await as("get", "/warehouses", token);

    expect(response.status).toBe(200);
    expect(response.body).toEqual([
      { ...PUBLIC_WAREHOUSE, id: first.id },
      {
        id: second.id,
        name: "Bodega Norte",
        observations: null,
        address: "Calle 2 #45",
      },
    ]);
  });

  it("returns an empty array when there are no warehouses", async () => {
    const token = await tokenFor("admin");

    const response = await as("get", "/warehouses", token);

    expect(response.status).toBe(200);
    expect(response.body).toEqual([]);
  });

  it("searches partially and case-insensitively without duplicates", async () => {
    const first = await createWarehouse();
    const second = await createWarehouse({
      name: "Bodega Norte",
      observations: "Turno nocturno",
      address: "Calle 2 #45",
    });
    const third = await createWarehouse({
      name: "Depósito Sur",
      observations: "Zona central de distribución",
      address: "Calle Central 45",
    });
    const token = await tokenFor("manager_warehouse");

    const byName = await as("get", "/warehouses?search=CENTRAL", token);
    expect(byName.status).toBe(200);
    expect(byName.body).toEqual([
      { ...PUBLIC_WAREHOUSE, id: first.id },
      {
        id: third.id,
        name: "Depósito Sur",
        observations: "Zona central de distribución",
        address: "Calle Central 45",
      },
    ]);

    const byAddress = await as("get", "/warehouses?search=calle%202", token);
    expect(byAddress.status).toBe(200);
    expect(byAddress.body).toEqual([
      {
        id: second.id,
        name: "Bodega Norte",
        observations: "Turno nocturno",
        address: "Calle 2 #45",
      },
    ]);

    const byObservations = await as("get", "/warehouses?search=horario", token);
    expect(byObservations.status).toBe(200);
    expect(byObservations.body).toEqual([
      { ...PUBLIC_WAREHOUSE, id: first.id },
    ]);
  });

  it("returns the full list for blank searches and none for misses", async () => {
    const first = await createWarehouse();
    const second = await createWarehouse({
      name: "Bodega Norte",
      observations: null,
      address: "Calle 2 #45",
    });
    const token = await tokenFor("admin");

    const blank = await as("get", "/warehouses?search=%20%20", token);
    expect(blank.status).toBe(200);
    expect(blank.body.map((warehouse) => warehouse.id)).toEqual([
      first.id,
      second.id,
    ]);

    const missing = await as("get", "/warehouses?search=inexistente", token);
    expect(missing.status).toBe(200);
    expect(missing.body).toEqual([]);
  });

  it.each(["seller", "support", "customer"])(
    "responds 403 for a %s",
    async (role) => {
      const token = await tokenFor(role);

      const response = await as("get", "/warehouses", token);

      expect(response.status).toBe(403);
      expect(response.body).toEqual({ message: "Forbidden" });
    },
  );
});
