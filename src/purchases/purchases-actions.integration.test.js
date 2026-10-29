process.env.JWT_SECRET = process.env.JWT_SECRET || "integration-test-secret";

const sequelize = require("../database");
const Purchase = require("../models/purchase");
const PurchaseItem = require("../models/purchase-item");
const Cost = require("../models/cost");
const Stock = require("../models/stock");
const { assertTestDatabase } = require("../../test/helpers/test-database");
const {
  as,
  createPurchase,
  createPurchaseItem,
  createPurchaseSupplier,
  resetDatabase,
  tokenFor,
} = require("../../test/helpers/purchases");

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

describe("PUT /purchases/:id with a real database", () => {
  it("updates supplier, tax rate and notes and recalculates the totals", async () => {
    const supplier = await createPurchaseSupplier();
    const otherSupplier = await createPurchaseSupplier({
      identification: "J-99999999-9",
      email: "otro@example.com",
    });
    const purchase = await createPurchase({ supplier_id: supplier.id });
    await createPurchaseItem({ purchase_id: purchase.id });
    const token = await tokenFor("seller");

    const response = await as("put", `/purchases/${purchase.id}`, token).send({
      supplier_id: otherSupplier.id,
      tax_rate: 8.25,
      notes: "Actualizada",
    });

    expect(response.status).toBe(202);
    expect(response.body).toEqual(
      expect.objectContaining({
        id: purchase.id,
        supplier_id: otherSupplier.id,
        subtotal: 100,
        tax_rate: 8.25,
        tax_amount: 8.25,
        total: 108.25,
        notes: "Actualizada",
      }),
    );
    expect(response.body.items).toHaveLength(1);
    expect(response.body).not.toHaveProperty("updatedAt");

    const stored = await Purchase.findByPk(purchase.id);
    expect(Number(stored.total)).toBe(108.25);
  });

  it("responds 409 for a confirmed purchase, 400 for an empty body and 422 for ids", async () => {
    const purchase = await createPurchase({
      status: "confirmed",
      confirmed_at: new Date(),
    });
    const token = await tokenFor("admin");

    const conflict = await as("put", `/purchases/${purchase.id}`, token).send({
      notes: "no",
    });
    expect(conflict.status).toBe(409);
    expect(conflict.body).toEqual({ message: "Purchase is not editable" });

    const empty = await as("put", `/purchases/${purchase.id}`, token).send({});
    expect(empty.status).toBe(400);

    const invalid = await as("put", "/purchases/abc", token).send({
      notes: "x",
    });
    expect(invalid.status).toBe(422);

    const draft = await createPurchase();
    const missingSupplier = await as(
      "put",
      `/purchases/${draft.id}`,
      token,
    ).send({ supplier_id: 99999 });
    expect(missingSupplier.status).toBe(422);
    expect(missingSupplier.body).toEqual({
      errors: { supplier_id: "Invalid supplier id" },
    });
  });
});

describe("DELETE and cancel with a real database", () => {
  it("deletes a draft with its lines and responds 204", async () => {
    const purchase = await createPurchase();
    const item = await createPurchaseItem({ purchase_id: purchase.id });
    const token = await tokenFor("admin");

    const response = await as("delete", `/purchases/${purchase.id}`, token);

    expect(response.status).toBe(204);
    await expect(Purchase.findByPk(purchase.id)).resolves.toBeNull();
    await expect(PurchaseItem.findByPk(item.id)).resolves.toBeNull();
  });

  it("responds 409 when deleting or cancelling a confirmed purchase", async () => {
    const confirmed = await createPurchase({
      status: "confirmed",
      confirmed_at: new Date(),
    });
    const token = await tokenFor("seller");

    const deleted = await as("delete", `/purchases/${confirmed.id}`, token);
    expect(deleted.status).toBe(409);

    const cancelled = await as(
      "post",
      `/purchases/${confirmed.id}/cancel`,
      token,
    );
    expect(cancelled.status).toBe(409);
    expect(cancelled.body).toEqual({ message: "Purchase is not editable" });
  });

  it("cancels a draft without touching costs or stocks", async () => {
    const purchase = await createPurchase();
    await createPurchaseItem({ purchase_id: purchase.id });
    const token = await tokenFor("seller");

    const response = await as(
      "post",
      `/purchases/${purchase.id}/cancel`,
      token,
    );

    expect(response.status).toBe(200);
    expect(response.body.status).toBe("cancelled");
    expect(response.body.items).toHaveLength(1);
    expect(await Cost.count()).toBe(0);
    expect(await Stock.count()).toBe(0);

    const again = await as("post", `/purchases/${purchase.id}/cancel`, token);
    expect(again.status).toBe(409);
  });

  it("responds 404 for an unknown purchase and 403 for a read-only role", async () => {
    const token = await tokenFor("admin");
    const missing = await as("delete", "/purchases/99999", token);
    expect(missing.status).toBe(404);

    const manager = await tokenFor("manager_warehouse");
    const purchase = await createPurchase();
    const forbidden = await as("delete", `/purchases/${purchase.id}`, manager);
    expect(forbidden.status).toBe(403);
  });
});

describe("purchase numbering under concurrency", () => {
  it("assigns unique ascending numbers to parallel creates", async () => {
    const supplier = await createPurchaseSupplier();
    const token = await tokenFor("admin");
    const requests = Array.from({ length: 8 }, () =>
      as("post", "/purchases", token).send({ supplier_id: supplier.id }),
    );

    const responses = await Promise.all(requests);

    expect(responses.every((response) => response.status === 201)).toBe(true);
    const numbers = responses
      .map((response) => response.body.number)
      .sort((left, right) => left - right);
    expect(new Set(numbers).size).toBe(8);
    expect(numbers).toEqual(
      Array.from({ length: 8 }, (value, index) => index + 1),
    );
    expect(await Purchase.count()).toBe(8);
  }, 60000);
});
