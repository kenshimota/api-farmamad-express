process.env.JWT_SECRET = process.env.JWT_SECRET || "integration-test-secret";

const request = require("supertest");
const app = require("../app");
const sequelize = require("../database");
const ItemState = require("../models/item-state");
const Cost = require("../models/cost");
const { createProduct } = require("../../test/helpers/products");
const { assertTestDatabase } = require("../../test/helpers/test-database");
const {
  BODY,
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

describe("PUT /item-states/:id with a real database", () => {
  it.each(["admin", "seller"])(
    "allows a %s to update the item state and answers 202",
    async (role) => {
      const itemState = await createItemState();
      const token = await tokenFor(role);

      const response = await as(
        "put",
        `/item-states/${itemState.id}`,
        token,
      ).send({
        name: "returned",
        label: "Devuelto",
        description: "Devuelto por el cliente",
        is_sellable: true,
      });

      expect(response.status).toBe(202);
      expect(response.body).toEqual({
        id: itemState.id,
        name: "returned",
        label: "Devuelto",
        description: "Devuelto por el cliente",
        is_sellable: true,
      });

      const stored = await ItemState.findByPk(itemState.id);
      expect(stored.name).toBe("returned");
      expect(stored.is_sellable).toBe(true);
    },
  );

  it("updates only the provided fields and clears the description", async () => {
    const itemState = await createItemState({
      description: "Temporal",
      is_sellable: true,
    });
    const token = await tokenFor("admin");

    const labeled = await as("put", `/item-states/${itemState.id}`, token).send(
      { label: "  Disponible  " },
    );
    expect(labeled.status).toBe(202);
    expect(labeled.body).toEqual({
      id: itemState.id,
      name: "sellable",
      label: "Disponible",
      description: "Temporal",
      is_sellable: true,
    });

    const cleared = await as("put", `/item-states/${itemState.id}`, token).send(
      { description: null },
    );
    expect(cleared.status).toBe(202);
    expect(cleared.body.description).toBeNull();
  });

  it("allows renaming an item state that is not referenced", async () => {
    const itemState = await createItemState();
    const token = await tokenFor("seller");

    const response = await as(
      "put",
      `/item-states/${itemState.id}`,
      token,
    ).send({ name: "available" });

    expect(response.status).toBe(202);
    expect(response.body.name).toBe("available");
    await expect(ItemState.findByPk(itemState.id)).resolves.toMatchObject({
      name: "available",
    });
  });

  it("responds 409 and keeps the name when a real cost references the item state", async () => {
    const itemState = await createItemState();
    const product = await createProduct({ reference: "ITEM-STATE-RENAME" });
    const token = await tokenFor("seller");
    const cost = await Cost.create({
      product_id: product.id,
      item_state_id: itemState.id,
      cost: 10,
    });

    try {
      const response = await as(
        "put",
        `/item-states/${itemState.id}`,
        token,
      ).send({ name: "available" });

      expect(response.status).toBe(409);
      expect(response.body).toEqual({ message: "Item state is in use" });
      await expect(ItemState.findByPk(itemState.id)).resolves.toMatchObject({
        name: "sellable",
      });
    } finally {
      await cost.destroy();
      await product.destroy();
    }
  });

  it("responds 409 when the name belongs to another item state", async () => {
    await createItemState({ name: "sellable" });
    const other = await createItemState({
      name: "damaged",
      label: "Maltratado",
    });
    const token = await tokenFor("seller");

    const response = await as("put", `/item-states/${other.id}`, token).send({
      name: "sellable",
    });

    expect(response.status).toBe(409);
    expect(response.body).toEqual({ message: "Item state already exists" });
  });

  it("responds 400, 404 and 422 for invalid requests", async () => {
    const itemState = await createItemState();
    const token = await tokenFor("admin");

    const empty = await as("put", `/item-states/${itemState.id}`, token).send(
      {},
    );
    expect(empty.status).toBe(400);
    expect(empty.body).toEqual({
      message: "at least one field is required",
    });

    const missing = await as("put", "/item-states/99999", token).send(BODY);
    expect(missing.status).toBe(404);
    expect(missing.body).toEqual({ message: "Item state not found" });

    const invalid = await as("put", `/item-states/${itemState.id}`, token).send(
      { name: "Sellable" },
    );
    expect(invalid.status).toBe(422);
    expect(invalid.body).toEqual({
      errors: { name: "name must be snake_case" },
    });

    const invalidId = await as("put", "/item-states/0", token).send(BODY);
    expect(invalidId.status).toBe(422);
    expect(invalidId.body).toEqual({
      errors: { id: "Invalid item state id" },
    });
  });

  it("responds 403 for a dispatcher user", async () => {
    const itemState = await createItemState();
    const token = await tokenFor("dispatcher");

    const response = await as(
      "put",
      `/item-states/${itemState.id}`,
      token,
    ).send(BODY);

    expect(response.status).toBe(403);
    expect(response.body).toEqual({ message: "Forbidden" });
  });
});

describe("DELETE /item-states/:id with a real database", () => {
  it.each(["admin", "seller"])(
    "allows a %s to delete an unreferenced item state and answers 204",
    async (role) => {
      const itemState = await createItemState();
      const token = await tokenFor(role);

      const response = await as(
        "delete",
        `/item-states/${itemState.id}`,
        token,
      );

      expect(response.status).toBe(204);
      expect(response.text).toBe("");
      await expect(ItemState.findByPk(itemState.id)).resolves.toBeNull();
    },
  );

  it("responds 409 and keeps the item state when a real cost references it", async () => {
    const itemState = await createItemState();
    const product = await createProduct({ reference: "ITEM-STATE-DELETE" });
    const token = await tokenFor("admin");
    const cost = await Cost.create({
      product_id: product.id,
      item_state_id: itemState.id,
      cost: 10,
    });

    try {
      const response = await as(
        "delete",
        `/item-states/${itemState.id}`,
        token,
      );

      expect(response.status).toBe(409);
      expect(response.body).toEqual({ message: "Item state is in use" });
      await expect(ItemState.findByPk(itemState.id)).resolves.not.toBeNull();
    } finally {
      await cost.destroy();
      await product.destroy();
    }
  });

  it("responds 404 and 422 for unknown and invalid ids", async () => {
    const token = await tokenFor("admin");

    const missing = await as("delete", "/item-states/99999", token);
    expect(missing.status).toBe(404);
    expect(missing.body).toEqual({ message: "Item state not found" });

    const invalid = await as("delete", "/item-states/abc", token);
    expect(invalid.status).toBe(422);
    expect(invalid.body).toEqual({
      errors: { id: "Invalid item state id" },
    });
  });

  it("responds 403 for a dispatcher user", async () => {
    const itemState = await createItemState();
    const token = await tokenFor("dispatcher");

    const response = await as("delete", `/item-states/${itemState.id}`, token);

    expect(response.status).toBe(403);
    expect(response.body).toEqual({ message: "Forbidden" });
  });

  it("responds 401 without a token", async () => {
    const itemState = await createItemState();

    const response = await request(app).delete(`/item-states/${itemState.id}`);

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ message: "Unauthorized" });
  });
});
