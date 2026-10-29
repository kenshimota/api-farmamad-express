process.env.JWT_SECRET = process.env.JWT_SECRET || "integration-test-secret";

const request = require("supertest");
const app = require("../app");
const sequelize = require("../database");
const MethodPaymentType = require("../models/method-payment-type");
const { assertTestDatabase } = require("../../test/helpers/test-database");
const {
  FIELD,
  as,
  createCurrency,
  createMethodPaymentType,
  resetDatabase,
  tokenFor,
} = require("../../test/helpers/method-payment-types");

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

describe("PUT /method-payment-types/:id with a real database", () => {
  it("updates the editable fields and answers 202", async () => {
    const currency = await createCurrency();
    const type = await createMethodPaymentType({
      code: "PAYPAL",
      currency_id: currency.id,
    });
    const token = await tokenFor("admin");

    const response = await as(
      "put",
      `/method-payment-types/${type.id}`,
      token,
    ).send({
      name: "PayPal actualizado",
      description: "Pagos actualizados",
      is_active: false,
    });

    expect(response.status).toBe(202);
    expect(response.body).toEqual(
      expect.objectContaining({
        id: type.id,
        code: "PAYPAL",
        name: "PayPal actualizado",
        description: "Pagos actualizados",
        is_active: false,
        currency_id: currency.id,
      }),
    );

    const stored = await MethodPaymentType.findByPk(type.id);
    expect(stored.name).toBe("PayPal actualizado");
    expect(stored.is_active).toBe(false);
  });

  it("ignores code on update because it is immutable", async () => {
    const currency = await createCurrency();
    const type = await createMethodPaymentType({
      code: "PAYPAL",
      currency_id: currency.id,
    });
    const token = await tokenFor("admin");

    const response = await as(
      "put",
      `/method-payment-types/${type.id}`,
      token,
    ).send({ code: "OTHER", name: "PayPal" });

    expect(response.status).toBe(202);
    expect(response.body.code).toBe("PAYPAL");

    const stored = await MethodPaymentType.findByPk(type.id);
    expect(stored.code).toBe("PAYPAL");
  });

  it("changes currency_id and fields when the type has no methods", async () => {
    const current = await createCurrency();
    const next = await createCurrency();
    const type = await createMethodPaymentType({
      code: "CUSTOM",
      currency_id: current.id,
      fields: [FIELD],
    });
    const token = await tokenFor("admin");
    const fields = [{ ...FIELD, required: false }];

    const response = await as(
      "put",
      `/method-payment-types/${type.id}`,
      token,
    ).send({ currency_id: next.id, fields });

    expect(response.status).toBe(202);
    expect(response.body.currency_id).toBe(next.id);
    expect(response.body.currency).toEqual({
      id: next.id,
      code: next.code,
      name: next.name,
      symbol: next.symbol,
    });
    expect(response.body.fields).toEqual(fields);

    const stored = await MethodPaymentType.findByPk(type.id);
    expect(stored.currency_id).toBe(next.id);
    expect(stored.fields).toEqual(fields);
  });

  it("responds 400, 404, 422 and 422 Invalid currency", async () => {
    const currency = await createCurrency();
    const type = await createMethodPaymentType({
      code: "PAYPAL",
      currency_id: currency.id,
    });
    const token = await tokenFor("admin");

    const empty = await as(
      "put",
      `/method-payment-types/${type.id}`,
      token,
    ).send({ code: "OTHER" });
    expect(empty.status).toBe(400);
    expect(empty.body).toEqual({
      message: "At least one field is required",
    });

    const missing = await as("put", "/method-payment-types/99999", token).send({
      name: "Banco",
    });
    expect(missing.status).toBe(404);
    expect(missing.body).toEqual({ message: "Payment type not found" });

    const invalid = await as(
      "put",
      `/method-payment-types/${type.id}`,
      token,
    ).send({ fields: [{ ...FIELD, type: "select" }] });
    expect(invalid.status).toBe(422);
    expect(invalid.body).toEqual({
      errors: { fields: "Invalid fields definition" },
    });

    const invalidCurrency = await as(
      "put",
      `/method-payment-types/${type.id}`,
      token,
    ).send({ currency_id: 999999 });
    expect(invalidCurrency.status).toBe(422);
    expect(invalidCurrency.body).toEqual({
      errors: { currency_id: "Invalid currency" },
    });

    const invalidId = await as("put", "/method-payment-types/abc", token).send({
      name: "Banco",
    });
    expect(invalidId.status).toBe(422);
    expect(invalidId.body).toEqual({
      errors: { id: "Invalid payment type id" },
    });
  });

  it("responds 401 and 403 for unauthorized roles", async () => {
    const currency = await createCurrency();
    const type = await createMethodPaymentType({
      code: "PAYPAL",
      currency_id: currency.id,
    });

    const anonymous = await request(app)
      .put(`/method-payment-types/${type.id}`)
      .send({ name: "Banco" });
    expect(anonymous.status).toBe(401);

    const seller = await tokenFor("seller");
    const forbidden = await as(
      "put",
      `/method-payment-types/${type.id}`,
      seller,
    ).send({ name: "Banco" });
    expect(forbidden.status).toBe(403);
    expect(forbidden.body).toEqual({ message: "Forbidden" });
  });
});

describe("DELETE /method-payment-types/:id with a real database", () => {
  it("deletes the type physically and answers 204", async () => {
    const currency = await createCurrency();
    const type = await createMethodPaymentType({
      code: "PAYPAL",
      currency_id: currency.id,
    });
    const token = await tokenFor("admin");

    const response = await as(
      "delete",
      `/method-payment-types/${type.id}`,
      token,
    );

    expect(response.status).toBe(204);
    expect(response.text).toBe("");
    await expect(MethodPaymentType.findByPk(type.id)).resolves.toBeNull();

    const again = await as("delete", `/method-payment-types/${type.id}`, token);
    expect(again.status).toBe(404);
    expect(again.body).toEqual({ message: "Payment type not found" });
  });

  it("responds 401 and 403 for unauthorized roles", async () => {
    const currency = await createCurrency();
    const type = await createMethodPaymentType({
      code: "PAYPAL",
      currency_id: currency.id,
    });

    const anonymous = await request(app).delete(
      `/method-payment-types/${type.id}`,
    );
    expect(anonymous.status).toBe(401);

    const seller = await tokenFor("seller");
    const forbidden = await as(
      "delete",
      `/method-payment-types/${type.id}`,
      seller,
    );
    expect(forbidden.status).toBe(403);
    expect(forbidden.body).toEqual({ message: "Forbidden" });

    const stored = await MethodPaymentType.findByPk(type.id);
    expect(stored).not.toBeNull();
  });
});
