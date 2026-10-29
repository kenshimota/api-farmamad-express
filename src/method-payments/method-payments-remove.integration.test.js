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

describe("DELETE /method-payments/:id with a real database", () => {
  it("deletes the method physically and answers 204", async () => {
    const { method } = await buildMethod();
    const token = await tokenFor("admin");

    const response = await as("delete", `/method-payments/${method.id}`, token);

    expect(response.status).toBe(204);
    expect(response.text).toBe("");
    await expect(MethodPayment.findByPk(method.id)).resolves.toBeNull();

    const again = await as("delete", `/method-payments/${method.id}`, token);
    expect(again.status).toBe(404);
    expect(again.body).toEqual({ message: "Payment method not found" });
  });

  it("responds 409 when another table references the method", async () => {
    const { method } = await buildMethod();
    const token = await tokenFor("admin");

    await sequelize.query(
      "DROP TABLE IF EXISTS method_payment_delete_guard_test",
    );
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS method_payment_delete_guard_test (
        id INTEGER PRIMARY KEY,
        method_payment_id INTEGER NOT NULL REFERENCES method_payments(id) ON DELETE RESTRICT
      )
    `);
    await sequelize.query(`
      INSERT INTO method_payment_delete_guard_test (id, method_payment_id)
      VALUES (1, ${method.id})
    `);

    try {
      const response = await as(
        "delete",
        `/method-payments/${method.id}`,
        token,
      );

      expect(response.status).toBe(409);
      expect(response.body).toEqual({
        message: "Payment method is in use",
      });
      await expect(MethodPayment.findByPk(method.id)).resolves.not.toBeNull();
    } finally {
      await sequelize.query(
        "DROP TABLE IF EXISTS method_payment_delete_guard_test",
      );
    }
  });

  it("responds 401 and 403 for unauthorized roles", async () => {
    const { method } = await buildMethod();

    const anonymous = await request(app).delete(
      `/method-payments/${method.id}`,
    );
    expect(anonymous.status).toBe(401);

    const seller = await tokenFor("seller");
    const forbidden = await as(
      "delete",
      `/method-payments/${method.id}`,
      seller,
    );
    expect(forbidden.status).toBe(403);
    await expect(MethodPayment.findByPk(method.id)).resolves.not.toBeNull();
  });
});
