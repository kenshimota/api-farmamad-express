process.env.JWT_SECRET = process.env.JWT_SECRET || "integration-test-secret";

const sequelize = require("../database");
const { assertTestDatabase } = require("../../test/helpers/test-database");
const {
  assignSeller,
  createOrderFixture,
} = require("../../test/helpers/order-lifecycle");
const { as, resetDatabase, sessionFor } = require("../../test/helpers/orders");
const { ensurePaymentTerm } = require("../../test/helpers/payment-terms");

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
 * Builds a line for a fixture.
 * @param {object} fixture - Sale fixture.
 * @returns {object} The line.
 */
function lineFor(fixture) {
  return {
    product_id: fixture.product.id,
    item_state_id: fixture.itemState.id,
    quantity: 1,
  };
}

describe("order payment term with a real database", () => {
  it("copies the customer term and ignores a customer override", async () => {
    const fixture = await createOrderFixture({ term: "credit_10" });
    const credit15 = await ensurePaymentTerm("credit_15");

    const response = await as("post", "/orders", fixture.token).send({
      items: [lineFor(fixture)],
      payment_term_id: credit15.id,
    });

    expect(response.status).toBe(201);
    expect(response.body.payment_term_id).toBe(fixture.paymentTerm.id);
    expect(response.body.payment_term).toEqual({
      id: fixture.paymentTerm.id,
      code: "credit_10",
      name: "Crédito 10 días",
      days: 10,
    });
  });

  it("lets an assigned seller replace the term in draft and request", async () => {
    const fixture = await createOrderFixture({ term: "credit_10" });
    const seller = await sessionFor("seller");
    const credit15 = await ensurePaymentTerm("credit_15");
    await assignSeller(fixture.customer, seller.user);

    const created = await as("post", "/orders", seller.token).send({
      customer_id: fixture.customer.id,
      items: [lineFor(fixture)],
    });

    const draftEdit = await as(
      "put",
      `/orders/${created.body.id}/payment-term`,
      seller.token,
    ).send({ payment_term_id: credit15.id });
    expect(draftEdit.status).toBe(202);
    expect(draftEdit.body.payment_term_id).toBe(credit15.id);

    await as("put", `/orders/${created.body.id}/status`, fixture.token).send({
      status: "request",
    });

    const requestEdit = await as(
      "put",
      `/orders/${created.body.id}/payment-term`,
      seller.token,
    ).send({ payment_term_id: fixture.paymentTerm.id });
    expect(requestEdit.status).toBe(202);
    expect(requestEdit.body.payment_term_id).toBe(fixture.paymentTerm.id);
  });

  it("forbids customers and rejects edits after generate", async () => {
    const fixture = await createOrderFixture({ term: "credit_10" });
    const admin = await sessionFor("admin");
    const created = await as("post", "/orders", fixture.token).send({
      items: [lineFor(fixture)],
    });

    const customer = await as(
      "put",
      `/orders/${created.body.id}/payment-term`,
      fixture.token,
    ).send({ payment_term_id: fixture.paymentTerm.id });
    expect(customer.status).toBe(403);

    await as("put", `/orders/${created.body.id}/status`, admin.token).send({
      status: "generate",
    });
    const afterGenerate = await as(
      "put",
      `/orders/${created.body.id}/payment-term`,
      admin.token,
    ).send({ payment_term_id: fixture.paymentTerm.id });
    expect(afterGenerate.status).toBe(422);
    expect(afterGenerate.body).toEqual({
      errors: { status: "Order is not editable" },
    });
  });
});
