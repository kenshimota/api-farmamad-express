process.env.JWT_SECRET = process.env.JWT_SECRET || "integration-test-secret";

const request = require("supertest");
const app = require("../app");
const sequelize = require("../database");
const MethodPayment = require("../models/method-payment");
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
 * Creates a type with one active method.
 * @param {object} [options] - Fixture options.
 * @returns {Promise<object>} The created references.
 */
async function buildMethod(options = {}) {
  const currency = options.currency ?? (await createCurrency());
  const type =
    options.type ??
    (await createMethodPaymentType({
      code: options.code ?? "PAYPAL",
      currency_id: currency.id,
      fields: [EMAIL_FIELD],
      is_active: options.typeActive ?? true,
    }));
  const method = await createMethodPayment({
    method_payment_type_id: type.id,
    label: options.label ?? "PayPal Farmamad",
    details: { email: "pagos@farmamad.com" },
    is_active: options.isActive ?? true,
  });

  return { currency, type, method };
}

describe("PUT /method-payments/:id with a real database", () => {
  it("updates label, details and is_active and answers 202", async () => {
    const { method } = await buildMethod();
    const token = await tokenFor("admin");

    const response = await as(
      "put",
      `/method-payments/${method.id}`,
      token,
    ).send({
      label: "  PayPal principal  ",
      details: { email: "  tesoreria@farmamad.com  " },
      currency_id: 999,
      currency: { id: 999 },
    });

    expect(response.status).toBe(202);
    expect(response.body).toEqual(
      expect.objectContaining({
        id: method.id,
        label: "PayPal principal",
        details: { email: "tesoreria@farmamad.com" },
        is_active: true,
        currency_id: expect.any(Number),
      }),
    );

    const stored = await MethodPayment.findByPk(method.id);
    expect(stored.label).toBe("PayPal principal");
    expect(stored.details).toEqual({ email: "tesoreria@farmamad.com" });
  });

  it("rejects changing method_payment_type_id", async () => {
    const { type, method } = await buildMethod();
    const other = await createMethodPaymentType({
      code: "BANK",
      currency_id: type.currency_id,
      fields: [EMAIL_FIELD],
    });
    const token = await tokenFor("admin");

    const response = await as(
      "put",
      `/method-payments/${method.id}`,
      token,
    ).send({ method_payment_type_id: other.id });

    expect(response.status).toBe(422);
    expect(response.body).toEqual({
      errors: {
        method_payment_type_id: "method_payment_type_id cannot be changed",
      },
    });
  });

  it("revalidates details and responds 422 with field errors", async () => {
    const { method } = await buildMethod();
    const token = await tokenFor("admin");

    const response = await as(
      "put",
      `/method-payments/${method.id}`,
      token,
    ).send({ details: { cvv: "123" } });

    expect(response.status).toBe(422);
    expect(response.body).toEqual({
      errors: {
        "details.email": "email is required",
        "details.cvv": "Unknown field",
      },
    });
  });

  it("rejects reactivating when the type or its currency is inactive", async () => {
    const { type, method } = await buildMethod({ isActive: false });
    const token = await tokenFor("admin");

    type.set("is_active", false);
    await type.save();

    const inactiveType = await as(
      "put",
      `/method-payments/${method.id}`,
      token,
    ).send({ is_active: true });
    expect(inactiveType.status).toBe(422);
    expect(inactiveType.body).toEqual({
      errors: { method_payment_type_id: "Invalid payment type" },
    });

    type.set("is_active", true);
    await type.save();
    const currency = await sequelize.models.Currency.findByPk(type.currency_id);
    currency.set("is_active", false);
    await currency.save();

    const inactiveCurrency = await as(
      "put",
      `/method-payments/${method.id}`,
      token,
    ).send({ is_active: true });
    expect(inactiveCurrency.status).toBe(422);
    expect(inactiveCurrency.body).toEqual({
      errors: { method_payment_type_id: "Invalid payment type" },
    });
  });

  it("allows deactivating an active method even when its type is inactive", async () => {
    const { type, method } = await buildMethod();
    const token = await tokenFor("admin");

    type.set("is_active", false);
    await type.save();

    const response = await as(
      "put",
      `/method-payments/${method.id}`,
      token,
    ).send({ is_active: false });

    expect(response.status).toBe(202);
    expect(response.body.is_active).toBe(false);
    expect((await MethodPayment.findByPk(method.id)).is_active).toBe(false);
  });

  it("responds 409 for a duplicated label and 404 for an unknown method", async () => {
    const { type, method } = await buildMethod();
    const other = await createMethodPayment({
      method_payment_type_id: type.id,
      label: "Otra cuenta",
      details: { email: "pagos@farmamad.com" },
    });
    const token = await tokenFor("admin");

    const duplicate = await as(
      "put",
      `/method-payments/${other.id}`,
      token,
    ).send({ label: method.label });
    expect(duplicate.status).toBe(409);
    expect(duplicate.body).toEqual({
      message: "Payment method already exists",
    });

    const missing = await as("put", "/method-payments/99999", token).send({
      label: "PayPal",
    });
    expect(missing.status).toBe(404);
    expect(missing.body).toEqual({ message: "Payment method not found" });
  });

  it("responds 400, 401, 403 and 422 for invalid requests", async () => {
    const { method } = await buildMethod();
    const token = await tokenFor("admin");

    const empty = await as("put", `/method-payments/${method.id}`, token).send({
      currency_id: 1,
    });
    expect(empty.status).toBe(400);
    expect(empty.body).toEqual({
      message: "At least one field is required",
    });

    const anonymous = await request(app)
      .put(`/method-payments/${method.id}`)
      .send({ label: "PayPal" });
    expect(anonymous.status).toBe(401);

    const seller = await tokenFor("seller");
    const forbidden = await as(
      "put",
      `/method-payments/${method.id}`,
      seller,
    ).send({ label: "PayPal" });
    expect(forbidden.status).toBe(403);

    const invalidId = await as("put", "/method-payments/abc", token).send({
      label: "PayPal",
    });
    expect(invalidId.status).toBe(422);
    expect(invalidId.body).toEqual({
      errors: { id: "Invalid payment method id" },
    });
  });
});
