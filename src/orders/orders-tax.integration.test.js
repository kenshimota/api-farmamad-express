process.env.JWT_SECRET = process.env.JWT_SECRET || "integration-test-secret";

const sequelize = require("../database");
const Tax = require("../models/tax");
const { assertTestDatabase } = require("../../test/helpers/test-database");
const { createOrderFixture } = require("../../test/helpers/order-lifecycle");
const { as, resetDatabase, sessionFor } = require("../../test/helpers/orders");

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
 * Reads a seeded tax by code.
 * @param {string} code - Tax code.
 * @returns {Promise<object>} The tax instance.
 */
function findTax(code) {
  return Tax.findOne({ where: { code } });
}

/**
 * Builds a line for a fixture.
 * @param {object} fixture - Sale fixture.
 * @param {number} [quantity] - Quantity.
 * @returns {object} The line.
 */
function lineFor(fixture, quantity = 2) {
  return {
    product_id: fixture.product.id,
    item_state_id: fixture.itemState.id,
    quantity,
  };
}

/**
 * Sends a status transition.
 * @param {number} orderId - Order id.
 * @param {string} status - Destination status.
 * @param {string} token - Bearer token.
 * @returns {Promise<import("supertest").Response>} HTTP response.
 */
function transition(orderId, status, token) {
  return as("put", `/orders/${orderId}/status`, token).send({ status });
}

describe("order tax with a real database", () => {
  it("snapshots the line tax, totals the order and copies it to the invoice", async () => {
    const fixture = await createOrderFixture({ stock: 5 });
    const iva = await findTax("IVA");
    await fixture.product.update({ tax_id: iva.id });

    const created = await as("post", "/orders", fixture.token).send({
      items: [lineFor(fixture)],
    });

    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({
      subtotal: 28.58,
      tax_amount: 4.57,
      total: 33.15,
      items: [
        {
          product_id: fixture.product.id,
          quantity: 2,
          unit_price: 14.29,
          subtotal: 28.58,
          tax_id: iva.id,
          tax_code: "IVA",
          tax_name: "Impuesto al Valor Agregado",
          tax_rate: 16,
          tax_amount: 4.57,
          total: 33.15,
        },
      ],
    });

    const admin = await sessionFor("admin");
    await transition(created.body.id, "generate", admin.token);
    const invoiced = await transition(created.body.id, "invoiced", admin.token);
    expect(invoiced.status).toBe(202);

    const invoice = await as(
      "get",
      `/orders/${created.body.id}/invoice`,
      fixture.token,
    );

    expect(invoice.status).toBe(200);
    expect(invoice.body).toMatchObject({
      subtotal: 28.58,
      tax_amount: 4.57,
      total: 33.15,
      items: [
        {
          product_id: fixture.product.id,
          quantity: 2,
          unit_price: 14.29,
          subtotal: 28.58,
          tax_id: iva.id,
          tax_code: "IVA",
          tax_name: "Impuesto al Valor Agregado",
          tax_rate: 16,
          tax_amount: 4.57,
          total: 33.15,
        },
      ],
    });
  });

  it("recalculates draft lines with the current tax when generating", async () => {
    const fixture = await createOrderFixture({ stock: 5 });
    const sinIva = await findTax("SIN_IVA");
    await fixture.product.update({ tax_id: sinIva.id });

    const created = await as("post", "/orders", fixture.token).send({
      items: [lineFor(fixture)],
    });
    expect(created.body).toMatchObject({
      subtotal: 28.58,
      tax_amount: 0,
      total: 28.58,
      items: [
        {
          tax_id: sinIva.id,
          tax_code: "SIN_IVA",
          tax_rate: 0,
          tax_amount: 0,
          total: 28.58,
        },
      ],
    });

    const iva = await findTax("IVA");
    await fixture.product.update({ tax_id: iva.id });

    const admin = await sessionFor("admin");
    const generated = await transition(
      created.body.id,
      "generate",
      admin.token,
    );
    expect(generated.status).toBe(202);

    const stored = await as("get", `/orders/${created.body.id}`, fixture.token);
    expect(stored.body).toMatchObject({
      subtotal: 28.58,
      tax_amount: 4.57,
      total: 33.15,
      items: [
        {
          tax_id: iva.id,
          tax_code: "IVA",
          tax_name: "Impuesto al Valor Agregado",
          tax_rate: 16,
          tax_amount: 4.57,
          total: 33.15,
        },
      ],
    });
  });
});
