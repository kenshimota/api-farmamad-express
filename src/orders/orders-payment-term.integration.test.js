process.env.JWT_SECRET = process.env.JWT_SECRET || "integration-test-secret";

const sequelize = require("../database");
const { assertTestDatabase } = require("../../test/helpers/test-database");
const {
  Order,
  as,
  createLot,
  createSaleFixture,
  createStock,
  resetDatabase,
} = require("../../test/helpers/orders");
const {
  createPaymentTerm,
  ensurePaymentTerm,
} = require("../../test/helpers/payment-terms");

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

describe("order payment term snapshot with a real database", () => {
  it("copies the customer term, ignores a customer override and keeps the snapshot", async () => {
    const fixture = await createSaleFixture();
    const credit10 = await ensurePaymentTerm("credit_10");
    const credit15 = await ensurePaymentTerm("credit_15");
    await fixture.customer.update({ payment_term_id: credit10.id });
    await createLot(fixture.product, fixture.itemState, fixture.location, {
      stock: 5,
    });
    await createStock(fixture.product, fixture.itemState, 5);

    const response = await as("post", "/orders", fixture.token).send({
      items: [
        {
          product_id: fixture.product.id,
          item_state_id: fixture.itemState.id,
          quantity: 1,
        },
      ],
      payment_term_id: credit15.id,
    });

    expect(response.status).toBe(201);
    expect(response.body.payment_term_id).toBe(credit10.id);
    expect(response.body.payment_term).toEqual({
      id: credit10.id,
      code: "credit_10",
      name: "Crédito 10 días",
      days: 10,
    });

    await fixture.customer.update({ payment_term_id: credit15.id });
    const stored = await Order.findByPk(response.body.id);
    expect(stored.payment_term_id).toBe(credit10.id);
  });

  it("rejects an inactive term copied from the customer", async () => {
    const fixture = await createSaleFixture();
    const inactive = await createPaymentTerm({ is_active: false });
    await fixture.customer.update({ payment_term_id: inactive.id });
    await createLot(fixture.product, fixture.itemState, fixture.location, {
      stock: 5,
    });

    const response = await as("post", "/orders", fixture.token).send({
      items: [
        {
          product_id: fixture.product.id,
          item_state_id: fixture.itemState.id,
          quantity: 1,
        },
      ],
    });

    expect(response.status).toBe(422);
    expect(response.body).toEqual({
      errors: { payment_term_id: "Invalid payment term" },
    });
    await expect(Order.count()).resolves.toBe(0);
  });
});
