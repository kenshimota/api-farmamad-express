process.env.JWT_SECRET = process.env.JWT_SECRET || "integration-test-secret";

const request = require("supertest");
const { UniqueConstraintError } = require("sequelize");
const app = require("../app");
const sequelize = require("../database");
const PaymentTerm = require("../models/payment-term");
const Customer = require("../models/customer");
const Order = require("../models/order");
const User = require("../models/user");
const seeder = require("../../seeders/20260910000007-payment-terms");
const { assertTestDatabase } = require("../../test/helpers/test-database");
const {
  createPaymentTerm,
  uniqueCode,
} = require("../../test/helpers/payment-terms");
const {
  resetPaymentTermDatabase,
} = require("../../test/helpers/payment-terms-db");
const {
  createInvoice,
  createCustomer: createInvoiceCustomer,
} = require("../../test/helpers/invoice-fixtures");
const {
  ensureDefaultTransactionCurrency,
} = require("../../test/helpers/currency-default");
const { Invoice, InvoiceItem } = require("../../test/helpers/invoice-fixtures");
const {
  OrderHistory,
  OrderItem,
  OrderItemLotAllocation,
} = require("../../test/helpers/orders");
const { as, tokenFor } = require("../../test/helpers/taxes");

beforeAll(async () => {
  assertTestDatabase(sequelize.config.database);
  await sequelize.authenticate();
});

beforeEach(async () => {
  assertTestDatabase(sequelize.config.database);
  await resetPaymentTermDatabase();
});

afterAll(async () => {
  await sequelize.close();
});

describe("payment term seeder", () => {
  it("creates cash, credit_10 and credit_15 idempotently", async () => {
    const queryInterface = sequelize.getQueryInterface();

    await seeder.up(queryInterface);
    await seeder.up(queryInterface);

    const terms = await PaymentTerm.findAll({ order: [["days", "ASC"]] });

    expect(terms.map((term) => [term.code, term.days])).toEqual([
      ["cash", 0],
      ["credit_10", 10],
      ["credit_15", 15],
    ]);
  });
});

describe("POST and GET /payment-terms with a real database", () => {
  it("creates a term, lowercases the code and defaults is_active", async () => {
    const token = await tokenFor("admin");

    const response = await as("post", "/payment-terms", token).send({
      code: "  CREDIT_30  ",
      name: "Crédito 30 días",
      description: "Pago a 30 días",
      days: 30,
    });

    expect(response.status).toBe(201);
    expect(response.body).toEqual({
      id: expect.any(Number),
      code: "credit_30",
      name: "Crédito 30 días",
      description: "Pago a 30 días",
      days: 30,
      is_active: true,
    });
    expect(response.body).not.toHaveProperty("createdAt");

    const stored = await PaymentTerm.findByPk(response.body.id);
    expect(stored.code).toBe("credit_30");
  });

  it("lists by days and id ascending and filters by is_active", async () => {
    const inactive = await createPaymentTerm({
      code: "credit_45",
      days: 45,
      is_active: false,
    });
    const token = await tokenFor("seller");

    const all = await as("get", "/payment-terms", token);
    expect(all.status).toBe(200);
    expect(all.body.map((term) => term.code)).toEqual([
      "cash",
      "credit_10",
      "credit_15",
      "credit_45",
    ]);

    const active = await as("get", "/payment-terms?is_active=true", token);
    expect(active.body.map((term) => term.id)).not.toContain(inactive.id);

    const onlyInactive = await as(
      "get",
      "/payment-terms?is_active=false",
      token,
    );
    expect(onlyInactive.body.map((term) => term.id)).toEqual([inactive.id]);

    const invalid = await as("get", "/payment-terms?is_active=maybe", token);
    expect(invalid.status).toBe(422);
    expect(invalid.body).toEqual({
      errors: { is_active: "Invalid is_active" },
    });
  });

  it("returns the detail and validates ids and permissions", async () => {
    const token = await tokenFor("admin");
    const cash = await PaymentTerm.findOne({ where: { code: "cash" } });

    const detail = await as("get", `/payment-terms/${cash.id}`, token);
    expect(detail.status).toBe(200);
    expect(detail.body).toEqual({
      id: cash.id,
      code: "cash",
      name: "Contado",
      description: "Pago contra entrega o al momento de la venta",
      days: 0,
      is_active: true,
    });

    const invalid = await as("get", "/payment-terms/abc", token);
    expect(invalid.status).toBe(422);
    expect(invalid.body).toEqual({
      errors: { id: "Invalid payment term id" },
    });

    const missing = await as("get", "/payment-terms/99999", token);
    expect(missing.status).toBe(404);
    expect(missing.body).toEqual({ message: "Payment term not found" });

    const anonymous = await request(app).get("/payment-terms");
    expect(anonymous.status).toBe(401);

    for (const role of [
      "customer",
      "dispatcher",
      "manager_warehouse",
      "support",
    ]) {
      const forbidden = await tokenFor(role);
      const response = await as("get", "/payment-terms", forbidden);
      expect(response.status).toBe(403);
    }
  });

  it("rejects duplicated codes ignoring case and invalid days in the database", async () => {
    await expect(
      PaymentTerm.create({ code: "cash", name: "Duplicado", days: 0 }),
    ).rejects.toBeInstanceOf(UniqueConstraintError);

    await expect(
      PaymentTerm.create({ code: "invalid_code", name: "Negative", days: -1 }),
    ).rejects.toThrow();
    await expect(
      PaymentTerm.create({ code: "invalid_code", name: "High", days: 3651 }),
    ).rejects.toThrow();
    await expect(
      PaymentTerm.create({ code: "Bad Code", name: "Format", days: 5 }),
    ).rejects.toThrow();
  });
});

describe("PUT and DELETE /payment-terms with a real database", () => {
  it("updates the editable fields and keeps the code immutable", async () => {
    const term = await createPaymentTerm({ code: "credit_30", days: 30 });
    const token = await tokenFor("admin");

    const response = await as("put", `/payment-terms/${term.id}`, token).send({
      code: "other_code",
      name: "Crédito 45 días",
      description: "  Cuarenta y cinco días  ",
      days: 45,
      is_active: false,
    });

    expect(response.status).toBe(202);
    expect(response.body).toEqual({
      id: term.id,
      code: "credit_30",
      name: "Crédito 45 días",
      description: "Cuarenta y cinco días",
      days: 45,
      is_active: false,
    });

    const stored = await PaymentTerm.findByPk(term.id);
    expect(stored.code).toBe("credit_30");
    expect(stored.days).toBe(45);
    expect(stored.is_active).toBe(false);
  });

  it("responds 400, 404 and 422 for invalid updates", async () => {
    const term = await createPaymentTerm();
    const token = await tokenFor("admin");

    const empty = await as("put", `/payment-terms/${term.id}`, token).send({
      code: "ignored",
    });
    expect(empty.status).toBe(400);

    const missing = await as("put", "/payment-terms/99999", token).send({
      days: 10,
    });
    expect(missing.status).toBe(404);

    const invalid = await as("put", `/payment-terms/${term.id}`, token).send({
      days: -1,
    });
    expect(invalid.status).toBe(422);
    expect(invalid.body.errors).toHaveProperty("days");
  });

  it("deletes an unused term and answers 204", async () => {
    const term = await createPaymentTerm();
    const token = await tokenFor("seller");

    const response = await as("delete", `/payment-terms/${term.id}`, token);

    expect(response.status).toBe(204);
    expect(response.text).toBe("");
    await expect(PaymentTerm.findByPk(term.id)).resolves.toBeNull();

    const again = await as("delete", `/payment-terms/${term.id}`, token);
    expect(again.status).toBe(404);
  });

  it("responds 409 when a customer still uses the term", async () => {
    const term = await createPaymentTerm();
    await Customer.create({
      fullName: "Cliente con término",
      latitude: -17.78,
      longitude: -63.18,
      direction: "Calle 1",
      email: `${uniqueCode("c")}@example.com`,
      payment_term_id: term.id,
    });
    const token = await tokenFor("admin");

    const response = await as("delete", `/payment-terms/${term.id}`, token);

    expect(response.status).toBe(409);
    expect(response.body).toEqual({ message: "Payment term is in use" });
    await expect(PaymentTerm.findByPk(term.id)).resolves.not.toBeNull();
  });

  it("responds 409 when an order still uses the term", async () => {
    const term = await createPaymentTerm();
    const token = await tokenFor("admin");
    const customer = await createInvoiceCustomer();
    const user = await User.findOne({ where: { username: "admin" } });
    const currency = await ensureDefaultTransactionCurrency();
    await Order.create({
      number: 9001,
      customer_id: customer.id,
      user_id: user.id,
      currency_id: currency.id,
      status: "draft",
      subtotal: 10,
      total: 10,
      delivery_address: "Calle 1",
      payment_term_id: term.id,
    });

    const response = await as("delete", `/payment-terms/${term.id}`, token);

    expect(response.status).toBe(409);
    expect(response.body).toEqual({ message: "Payment term is in use" });
  });

  it("responds 409 when an invoice still uses the term", async () => {
    const term = await createPaymentTerm();
    const token = await tokenFor("admin");
    await createInvoice({ payment_term_id: term.id });

    const response = await as("delete", `/payment-terms/${term.id}`, token);

    expect(response.status).toBe(409);
    expect(response.body).toEqual({ message: "Payment term is in use" });
  });
});
