process.env.JWT_SECRET = process.env.JWT_SECRET || "integration-test-secret";

const request = require("supertest");
const app = require("../app");
const sequelize = require("../database");
const { assertTestDatabase } = require("../../test/helpers/test-database");
const {
  as,
  createCurrency,
  createMethodPayment,
  createMethodPaymentType,
  resetDatabase,
  tokenFor,
} = require("../../test/helpers/method-payments");

const EMAIL_FIELD = {
  key: "email",
  label: "Correo",
  type: "email",
  required: true,
};

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
 * Creates a type and two methods with the given order and statuses.
 * @param {object} options - Fixture options.
 * @returns {Promise<object>} The created references.
 */
async function buildFixture(options = {}) {
  const currency = await createCurrency();
  const type = await createMethodPaymentType({
    code: options.code ?? "PAYPAL",
    currency_id: currency.id,
    fields: [EMAIL_FIELD],
    is_active: options.typeActive ?? true,
  });
  const details = { email: "pagos@farmamad.com" };
  const first = await createMethodPayment({
    method_payment_type_id: type.id,
    label: "Zulu",
    details,
    is_active: options.firstActive ?? true,
  });
  const second = await createMethodPayment({
    method_payment_type_id: type.id,
    label: "Alfa",
    details,
    is_active: options.secondActive ?? true,
  });

  return { currency, type, first, second };
}

describe("GET /method-payments with a real database", () => {
  it("lists methods ordered by type and label with nested currency and type", async () => {
    const firstCurrency = await createCurrency();
    const secondCurrency = await createCurrency();
    const firstType = await createMethodPaymentType({
      code: "PAYPAL",
      currency_id: firstCurrency.id,
      fields: [EMAIL_FIELD],
    });
    const secondType = await createMethodPaymentType({
      code: "BANK",
      currency_id: secondCurrency.id,
      fields: [EMAIL_FIELD],
    });
    const details = { email: "pagos@farmamad.com" };
    const bank = await createMethodPayment({
      method_payment_type_id: secondType.id,
      label: "Banesco",
      details,
    });
    const paypalZulu = await createMethodPayment({
      method_payment_type_id: firstType.id,
      label: "Zulu",
      details,
    });
    const paypalAlfa = await createMethodPayment({
      method_payment_type_id: firstType.id,
      label: "Alfa",
      details,
    });
    const token = await tokenFor("dispatcher");

    const response = await as("get", "/method-payments", token);

    expect(response.status).toBe(200);
    expect(response.body.map((row) => row.id)).toEqual([
      paypalAlfa.id,
      paypalZulu.id,
      bank.id,
    ]);
    expect(response.body[0]).toEqual(
      expect.objectContaining({
        label: "Alfa",
        currency_id: firstCurrency.id,
        currency: {
          id: firstCurrency.id,
          code: firstCurrency.code,
          name: firstCurrency.name,
          symbol: firstCurrency.symbol,
        },
        method_payment_type: {
          id: firstType.id,
          code: "PAYPAL",
          name: firstType.name,
        },
      }),
    );
  });

  it("applies the type, currency and active filters", async () => {
    const first = await buildFixture();
    const otherCurrency = await createCurrency();
    const otherType = await createMethodPaymentType({
      code: "BANK",
      currency_id: otherCurrency.id,
      fields: [EMAIL_FIELD],
    });
    const other = await createMethodPayment({
      method_payment_type_id: otherType.id,
      label: "Banco",
      details: { email: "pagos@farmamad.com" },
      is_active: false,
    });
    const token = await tokenFor("seller");

    const byType = await as(
      "get",
      `/method-payments?method_payment_type_id=${first.type.id}`,
      token,
    );
    expect(byType.body.map((row) => row.id)).toEqual([
      first.second.id,
      first.first.id,
    ]);

    const byCurrency = await as(
      "get",
      `/method-payments?currency_id=${otherCurrency.id}`,
      token,
    );
    expect(byCurrency.body.map((row) => row.id)).toEqual([other.id]);

    const inactive = await as("get", "/method-payments?is_active=false", token);
    expect(inactive.body.map((row) => row.id)).toEqual([other.id]);
  });

  it("returns inactive methods when no filter is given", async () => {
    const fixture = await buildFixture({ secondActive: false });
    const token = await tokenFor("admin");

    const response = await as("get", "/method-payments", token);

    expect(response.body.map((row) => row.id)).toEqual([
      fixture.second.id,
      fixture.first.id,
    ]);
    expect(response.body.map((row) => row.is_active)).toEqual([false, true]);
  });

  it("returns the detail and validates ids and filters", async () => {
    const fixture = await buildFixture();
    const token = await tokenFor("seller");

    const detail = await as(
      "get",
      `/method-payments/${fixture.first.id}`,
      token,
    );
    expect(detail.status).toBe(200);
    expect(detail.body).toEqual(
      expect.objectContaining({
        id: fixture.first.id,
        details: { email: "pagos@farmamad.com" },
        method_payment_type: {
          id: fixture.type.id,
          code: "PAYPAL",
          name: fixture.type.name,
        },
      }),
    );

    const missing = await as("get", "/method-payments/99999", token);
    expect(missing.status).toBe(404);
    expect(missing.body).toEqual({ message: "Payment method not found" });

    const invalidId = await as("get", "/method-payments/abc", token);
    expect(invalidId.status).toBe(422);
    expect(invalidId.body).toEqual({
      errors: { id: "Invalid payment method id" },
    });

    for (const query of [
      "method_payment_type_id=abc",
      "currency_id=abc",
      "is_active=maybe",
    ]) {
      const response = await as("get", `/method-payments?${query}`, token);
      expect(response.status).toBe(422);
      expect(response.body.errors).toBeDefined();
    }
  });

  it("responds 401 and 403 for unauthorized roles", async () => {
    const anonymous = await request(app).get("/method-payments");
    expect(anonymous.status).toBe(401);

    const manager = await tokenFor("manager_warehouse");
    const forbidden = await as("get", "/method-payments", manager);
    expect(forbidden.status).toBe(403);
    expect(forbidden.body).toEqual({ message: "Forbidden" });
  });
});
