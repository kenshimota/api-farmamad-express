process.env.JWT_SECRET = process.env.JWT_SECRET || "integration-test-secret";

const sequelize = require("../database");
const MethodPaymentType = require("../models/method-payment-type");
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

describe("HU-28 rules with the real MethodPayment model", () => {
  it("blocks deleting a type that has concrete methods", async () => {
    const currency = await createCurrency();
    const type = await createMethodPaymentType({
      code: "PAYPAL",
      currency_id: currency.id,
      fields: [EMAIL_FIELD],
    });
    const method = await createMethodPayment({
      method_payment_type_id: type.id,
      label: "PayPal",
      details: { email: "pagos@farmamad.com" },
    });
    const token = await tokenFor("admin");

    const response = await as(
      "delete",
      `/method-payment-types/${type.id}`,
      token,
    );

    expect(response.status).toBe(409);
    expect(response.body).toEqual({ message: "Payment type has methods" });
    await expect(MethodPaymentType.findByPk(type.id)).resolves.not.toBeNull();
    expect(method.id).toEqual(expect.any(Number));
  });

  it("blocks changing fields or currency while methods exist", async () => {
    const currency = await createCurrency();
    const otherCurrency = await createCurrency();
    const type = await createMethodPaymentType({
      code: "BANK",
      currency_id: currency.id,
      fields: [EMAIL_FIELD],
    });
    await createMethodPayment({
      method_payment_type_id: type.id,
      label: "Banco",
      details: { email: "pagos@farmamad.com" },
    });
    const token = await tokenFor("admin");

    const fieldsResponse = await as(
      "put",
      `/method-payment-types/${type.id}`,
      token,
    ).send({ fields: [{ ...EMAIL_FIELD, required: false }] });
    expect(fieldsResponse.status).toBe(409);
    expect(fieldsResponse.body).toEqual({
      message: "Payment type has methods",
    });

    const currencyResponse = await as(
      "put",
      `/method-payment-types/${type.id}`,
      token,
    ).send({ currency_id: otherCurrency.id });
    expect(currencyResponse.status).toBe(409);
    expect(currencyResponse.body).toEqual({
      message: "Payment type has methods",
    });

    const allowed = await as(
      "put",
      `/method-payment-types/${type.id}`,
      token,
    ).send({ name: "Banco actualizado", is_active: false });
    expect(allowed.status).toBe(202);
    expect(allowed.body.name).toBe("Banco actualizado");
  });

  it("allows deleting the type after its methods are deleted", async () => {
    const currency = await createCurrency();
    const type = await createMethodPaymentType({
      code: "PAGO_MOVIL",
      currency_id: currency.id,
      fields: [EMAIL_FIELD],
    });
    const method = await createMethodPayment({
      method_payment_type_id: type.id,
      label: "Pago Móvil",
      details: { email: "pagos@farmamad.com" },
    });
    const token = await tokenFor("admin");

    const methodResponse = await as(
      "delete",
      `/method-payments/${method.id}`,
      token,
    );
    expect(methodResponse.status).toBe(204);

    const typeResponse = await as(
      "delete",
      `/method-payment-types/${type.id}`,
      token,
    );
    expect(typeResponse.status).toBe(204);
    await expect(MethodPaymentType.findByPk(type.id)).resolves.toBeNull();
  });
});
