process.env.JWT_SECRET = process.env.JWT_SECRET || "integration-test-secret";

const request = require("supertest");
const { UniqueConstraintError } = require("sequelize");
const app = require("../app");
const sequelize = require("../database");
const ItemState = require("../models/item-state");
const { assertTestDatabase } = require("../../test/helpers/test-database");
const {
  BODY,
  PUBLIC_ITEM_STATE,
  as,
  createItemState,
  resetDatabase,
  tokenFor,
} = require("../../test/helpers/item-states");

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

/**
 * Builds the expected public item state body.
 * @param {object} itemState - Stored item state instance.
 * @returns {object} Public representation.
 */
function publicItemState(itemState) {
  return {
    id: itemState.id,
    name: itemState.name,
    label: itemState.label,
    description: itemState.description,
    is_sellable: itemState.is_sellable,
  };
}

describe("POST /item-states with a real database", () => {
  it.each(["admin", "seller"])(
    "allows a %s to create an item state and answers 201",
    async (role) => {
      const token = await tokenFor(role);

      const response = await as("post", "/item-states", token).send(BODY);

      expect(response.status).toBe(201);
      expect(response.body).toEqual(PUBLIC_ITEM_STATE);
      expect(response.body).not.toHaveProperty("createdAt");
      expect(response.body).not.toHaveProperty("updatedAt");

      const stored = await ItemState.findByPk(response.body.id);
      expect(stored.name).toBe(BODY.name);
      expect(stored.label).toBe(BODY.label);
      expect(stored.is_sellable).toBe(false);
    },
  );

  it("trims the fields, keeps the description and stores is_sellable", async () => {
    const token = await tokenFor("admin");

    const response = await as("post", "/item-states", token).send({
      name: "  returned  ",
      label: "  Devuelto  ",
      description: "  Devuelto por el cliente  ",
      is_sellable: true,
    });

    expect(response.status).toBe(201);
    expect(response.body).toEqual({
      id: expect.any(Number),
      name: "returned",
      label: "Devuelto",
      description: "Devuelto por el cliente",
      is_sellable: true,
    });

    const stored = await ItemState.findByPk(response.body.id);
    expect(stored.description).toBe("Devuelto por el cliente");
    expect(stored.is_sellable).toBe(true);
  });

  it("discards unknown and audit fields", async () => {
    const token = await tokenFor("admin");

    const response = await as("post", "/item-states", token).send({
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

  it("responds 409 for a duplicated name", async () => {
    await createItemState();
    const token = await tokenFor("admin");

    const response = await as("post", "/item-states", token).send({
      name: "sellable",
      label: "Disponible",
    });

    expect(response.status).toBe(409);
    expect(response.body).toEqual({ message: "Item state already exists" });
  });

  it("enforces the case-insensitive uniqueness in the database", async () => {
    await createItemState({ name: "sellable" });

    await expect(
      ItemState.create({ name: "SELLABLE", label: "Disponible" }),
    ).rejects.toThrow(UniqueConstraintError);
  });

  it("responds 401 without a token", async () => {
    const response = await request(app).post("/item-states").send(BODY);

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ message: "Unauthorized" });
  });

  it.each(["dispatcher", "manager_warehouse", "support", "customer"])(
    "responds 403 for a %s",
    async (role) => {
      const token = await tokenFor(role);

      const response = await as("post", "/item-states", token).send(BODY);

      expect(response.status).toBe(403);
      expect(response.body).toEqual({ message: "Forbidden" });
    },
  );

  it("responds 400 and 422 for missing and invalid fields", async () => {
    const token = await tokenFor("admin");

    const missing = await as("post", "/item-states", token).send({});
    expect(missing.status).toBe(400);
    expect(missing.body).toEqual({
      message: "name and label are required",
    });

    const invalid = await as("post", "/item-states", token).send({
      name: "Sellable",
      label: "Vendible",
    });
    expect(invalid.status).toBe(422);
    expect(invalid.body).toEqual({
      errors: { name: "name must be snake_case" },
    });
  });

  it("responds 403 for a blocked user", async () => {
    const token = await tokenFor("admin");
    await require("../models/user").update(
      { isBlocked: true },
      { where: { username: "admin" } },
    );

    const response = await as("get", "/item-states", token);

    expect(response.status).toBe(403);
    expect(response.body).toEqual({ message: "User is blocked" });
  });
});

describe("GET /item-states with a real database", () => {
  it("returns the item states ordered by name with public fields", async () => {
    const sellable = await createItemState({ is_sellable: true });
    const damaged = await createItemState({
      name: "damaged",
      label: "Maltratado",
    });
    const expired = await createItemState({
      name: "expired",
      label: "Vencido",
    });
    const token = await tokenFor("dispatcher");

    const response = await as("get", "/item-states", token);

    expect(response.status).toBe(200);
    expect(response.body).toEqual([
      publicItemState(damaged),
      publicItemState(expired),
      publicItemState(sellable),
    ]);
  });

  it.each([
    ["true", ["sellable"]],
    ["false", ["damaged", "expired"]],
  ])("filters by is_sellable=%s", async (value, expectedNames) => {
    await createItemState({ name: "sellable", is_sellable: true });
    await createItemState({ name: "damaged", label: "Maltratado" });
    await createItemState({ name: "expired", label: "Vencido" });
    const token = await tokenFor("customer");

    const response = await as(
      "get",
      `/item-states?is_sellable=${value}`,
      token,
    );

    expect(response.status).toBe(200);
    expect(response.body.map((itemState) => itemState.name)).toEqual(
      expectedNames,
    );
  });

  it("returns an empty array when there are no item states", async () => {
    const token = await tokenFor("admin");

    const response = await as("get", "/item-states", token);

    expect(response.status).toBe(200);
    expect(response.body).toEqual([]);
  });

  it.each([
    "admin",
    "seller",
    "dispatcher",
    "manager_warehouse",
    "support",
    "customer",
  ])("allows a %s to read the list", async (role) => {
    await createItemState();
    const token = await tokenFor(role);

    const response = await as("get", "/item-states", token);

    expect(response.status).toBe(200);
    expect(response.body).toEqual([PUBLIC_ITEM_STATE]);
  });
});

describe("GET /item-states/:id with a real database", () => {
  it("returns one item state for the allowed roles", async () => {
    const itemState = await createItemState();
    const token = await tokenFor("customer");

    const response = await as("get", `/item-states/${itemState.id}`, token);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      ...PUBLIC_ITEM_STATE,
      id: itemState.id,
    });
  });

  it("responds 404 and 422 for unknown and invalid ids", async () => {
    const token = await tokenFor("admin");

    const missing = await as("get", "/item-states/99999", token);
    expect(missing.status).toBe(404);
    expect(missing.body).toEqual({ message: "Item state not found" });

    const invalid = await as("get", "/item-states/abc", token);
    expect(invalid.status).toBe(422);
    expect(invalid.body).toEqual({
      errors: { id: "Invalid item state id" },
    });
  });
});
