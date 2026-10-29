process.env.JWT_SECRET = process.env.JWT_SECRET || "integration-test-secret";

const request = require("supertest");
const app = require("../app");
const sequelize = require("../database");
const Purchase = require("../models/purchase");
const { assertTestDatabase } = require("../../test/helpers/test-database");
const { createProduct } = require("../../test/helpers/products");
const { createItemState } = require("../../test/helpers/item-states");
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

/**
 * Builds the references needed by a purchase.
 * @returns {Promise<object>} Supplier, products and item states.
 */
async function references() {
  const supplier = await createPurchaseSupplier();
  const product = await createProduct({ reference: "PUR-INT-1" });
  const sellable = await createItemState({
    name: "sellable",
    label: "Vendible",
    is_sellable: true,
  });
  const damaged = await createItemState({
    name: "damaged",
    label: "Maltratado",
  });

  return { supplier, product, sellable, damaged };
}

/**
 * Builds a purchase body with two lines.
 * @param {object} refs - References built by `references`.
 * @returns {object} Request body.
 */
function purchaseBody(refs) {
  return {
    supplier_id: refs.supplier.id,
    tax_rate: 16,
    notes: "Reposición mensual",
    items: [
      {
        product_id: refs.product.id,
        item_state_id: refs.sellable.id,
        quantity: 40,
        unit_cost: 20,
      },
      {
        product_id: refs.product.id,
        item_state_id: refs.damaged.id,
        quantity: 3,
        unit_cost: 12.5,
      },
    ],
  };
}

describe("POST /purchases with a real database", () => {
  it.each(["admin", "seller"])(
    "allows a %s to create a purchase with items and answers 201",
    async (role) => {
      const refs = await references();
      const token = await tokenFor(role);

      const response = await as("post", "/purchases", token).send(
        purchaseBody(refs),
      );

      expect(response.status).toBe(201);
      expect(response.body).toEqual({
        id: expect.any(Number),
        number: 1,
        supplier_id: refs.supplier.id,
        status: "draft",
        subtotal: 837.5,
        tax_rate: 16,
        tax_amount: 134,
        total: 971.5,
        notes: "Reposición mensual",
        items: [
          {
            id: expect.any(Number),
            product_id: refs.product.id,
            item_state_id: refs.sellable.id,
            quantity: 40,
            unit_cost: 20,
            subtotal: 800,
          },
          {
            id: expect.any(Number),
            product_id: refs.product.id,
            item_state_id: refs.damaged.id,
            quantity: 3,
            unit_cost: 12.5,
            subtotal: 37.5,
          },
        ],
      });
      expect(response.body).not.toHaveProperty("createdAt");
      expect(response.body).not.toHaveProperty("updatedAt");

      const stored = await Purchase.findByPk(response.body.id);
      expect(Number(stored.subtotal)).toBe(837.5);
      expect(stored.number).toBe(1);
    },
  );

  it("creates an empty draft and ignores server-owned fields", async () => {
    const refs = await references();
    const token = await tokenFor("admin");

    const response = await as("post", "/purchases", token).send({
      supplier_id: refs.supplier.id,
      number: 99,
      status: "confirmed",
      subtotal: 999,
      tax_amount: 999,
      total: 1998,
      confirmed_at: "2026-10-01",
      items: [],
    });

    expect(response.status).toBe(201);
    expect(response.body.number).toBe(1);
    expect(response.body.status).toBe("draft");
    expect(response.body.subtotal).toBe(0);
    expect(response.body.total).toBe(0);
    expect(response.body.items).toEqual([]);
  });

  it("uses PURCHASE_TAX_RATE as the default tax rate", async () => {
    const refs = await references();
    const token = await tokenFor("admin");
    const previous = process.env.PURCHASE_TAX_RATE;
    process.env.PURCHASE_TAX_RATE = "8.25";

    const response = await as("post", "/purchases", token).send({
      supplier_id: refs.supplier.id,
      items: [
        {
          product_id: refs.product.id,
          item_state_id: refs.sellable.id,
          quantity: 1,
          unit_cost: 100,
        },
      ],
    });

    if (previous === undefined) {
      delete process.env.PURCHASE_TAX_RATE;
    } else {
      process.env.PURCHASE_TAX_RATE = previous;
    }

    expect(response.status).toBe(201);
    expect(response.body.tax_rate).toBe(8.25);
    expect(response.body.tax_amount).toBe(8.25);
    expect(response.body.total).toBe(108.25);
  });

  it("responds 400, 409, 422, 401 and 403 for invalid requests", async () => {
    const refs = await references();
    const token = await tokenFor("admin");

    const missing = await as("post", "/purchases", token).send({});
    expect(missing.status).toBe(400);
    expect(missing.body).toEqual({ message: "supplier_id is required" });

    const duplicated = await as("post", "/purchases", token).send({
      supplier_id: refs.supplier.id,
      items: [
        {
          product_id: refs.product.id,
          item_state_id: refs.sellable.id,
          quantity: 1,
          unit_cost: 1,
        },
        {
          product_id: refs.product.id,
          item_state_id: refs.sellable.id,
          quantity: 2,
          unit_cost: 2,
        },
      ],
    });
    expect(duplicated.status).toBe(409);
    expect(duplicated.body).toEqual({ message: "Item already exists" });

    const missingSupplier = await as("post", "/purchases", token).send({
      supplier_id: 99999,
    });
    expect(missingSupplier.status).toBe(422);
    expect(missingSupplier.body).toEqual({
      errors: { supplier_id: "Invalid supplier id" },
    });

    const missingProduct = await as("post", "/purchases", token).send({
      supplier_id: refs.supplier.id,
      items: [
        {
          product_id: 99999,
          item_state_id: refs.sellable.id,
          quantity: 1,
          unit_cost: 1,
        },
      ],
    });
    expect(missingProduct.status).toBe(422);
    expect(missingProduct.body).toEqual({
      errors: { "items.0.product_id": "Invalid product id" },
    });

    const missingState = await as("post", "/purchases", token).send({
      supplier_id: refs.supplier.id,
      items: [
        {
          product_id: refs.product.id,
          item_state_id: 99999,
          quantity: 1,
          unit_cost: 1,
        },
      ],
    });
    expect(missingState.status).toBe(422);

    const anonymous = await request(app).post("/purchases").send({});
    expect(anonymous.status).toBe(401);

    const manager = await tokenFor("manager_warehouse");
    const forbidden = await as("post", "/purchases", manager).send({
      supplier_id: refs.supplier.id,
    });
    expect(forbidden.status).toBe(403);
  });
});
