process.env.JWT_SECRET = process.env.JWT_SECRET || "integration-test-secret";

const app = require("../app");
const sequelize = require("../database");
const Customer = require("../models/customer");
const { assertTestDatabase } = require("../../test/helpers/test-database");
const {
  createPaymentTerm,
  ensurePaymentTerm,
} = require("../../test/helpers/payment-terms");
const {
  BODY,
  as,
  createCustomer,
  resetDatabase,
  tokenFor,
} = require("../../test/helpers/customers");

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

describe("customer payment term assignment with a real database", () => {
  it("creates a customer with an active term and exposes its summary", async () => {
    const term = await ensurePaymentTerm("credit_10");
    const token = await tokenFor("seller");

    const response = await as("post", "/customers", token).send({
      ...BODY,
      payment_term_id: term.id,
    });

    expect(response.status).toBe(201);
    expect(response.body.payment_term_id).toBe(term.id);
    expect(response.body.payment_term).toEqual({
      id: term.id,
      code: "credit_10",
      name: "Crédito 10 días",
      days: 10,
    });

    const stored = await Customer.findByPk(response.body.id);
    expect(stored.payment_term_id).toBe(term.id);
  });

  it("omits the term on PUT, clears it with null and rejects inactive terms", async () => {
    const first = await ensurePaymentTerm("credit_10");
    const second = await ensurePaymentTerm("credit_15");
    const customer = await createCustomer({ payment_term_id: first.id });
    const token = await tokenFor("admin");

    const omitted = await as("put", `/customers/${customer.id}`, token).send(
      BODY,
    );
    expect(omitted.status).toBe(202);
    expect(omitted.body.payment_term_id).toBe(first.id);

    const cleared = await as("put", `/customers/${customer.id}`, token).send({
      ...BODY,
      payment_term_id: null,
    });
    expect(cleared.status).toBe(202);
    expect(cleared.body.payment_term_id).toBeNull();
    expect(cleared.body.payment_term).toBeNull();

    await second.update({ is_active: false });
    const inactive = await as("put", `/customers/${customer.id}`, token).send({
      ...BODY,
      payment_term_id: second.id,
    });
    expect(inactive.status).toBe(422);
    expect(inactive.body).toEqual({
      errors: { payment_term_id: "Invalid payment term" },
    });

    const unknown = await as("put", `/customers/${customer.id}`, token).send({
      ...BODY,
      payment_term_id: 999999,
    });
    expect(unknown.status).toBe(422);

    const deactivated = await createPaymentTerm({ is_active: false });
    const rejected = await as("post", "/customers", token).send({
      ...BODY,
      email: "inactive@example.com",
      payment_term_id: deactivated.id,
    });
    expect(rejected.status).toBe(422);
    expect(rejected.body).toEqual({
      errors: { payment_term_id: "Invalid payment term" },
    });
  });
});
