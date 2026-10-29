process.env.JWT_SECRET = process.env.JWT_SECRET || "integration-test-secret";

const sequelize = require("../database");
const MethodPayment = require("../models/method-payment");
const { assertTestDatabase } = require("../../test/helpers/test-database");
const {
  as,
  createCurrency,
  createMethodPaymentType,
  resetDatabase,
  tokenFor,
} = require("../../test/helpers/method-payments");

const PAYPAL_FIELDS = [
  { key: "email", label: "Correo", type: "email", required: true },
];
const FULL_FIELDS = [
  { key: "holder", label: "Titular", type: "text", required: true },
  { key: "email", label: "Correo", type: "email", required: true },
  { key: "phone", label: "Teléfono", type: "phone", required: true },
  { key: "count", label: "Cantidad", type: "integer", required: false },
  { key: "enabled", label: "Activo", type: "boolean", required: false },
  {
    key: "short",
    label: "Corto",
    type: "text",
    required: false,
    max_length: 3,
  },
];

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

describe("POST /method-payments details with a real database", () => {
  it("validates details dynamically against the type fields", async () => {
    const currency = await createCurrency();
    const type = await createMethodPaymentType({
      code: "FULL",
      currency_id: currency.id,
      fields: FULL_FIELDS,
    });
    const token = await tokenFor("admin");
    const body = {
      method_payment_type_id: type.id,
      label: "Método completo",
    };

    const missing = await as("post", "/method-payments", token).send({
      ...body,
      details: {},
    });
    expect(missing.status).toBe(422);
    expect(missing.body.errors).toEqual({
      "details.holder": "holder is required",
      "details.email": "email is required",
      "details.phone": "phone is required",
    });

    const unknown = await as("post", "/method-payments", token).send({
      ...body,
      details: {
        holder: "Farmamad",
        email: "pagos@farmamad.com",
        phone: "04141234567",
        cvv: "123",
      },
    });
    expect(unknown.status).toBe(422);
    expect(unknown.body).toEqual({
      errors: { "details.cvv": "Unknown field" },
    });

    const invalid = await as("post", "/method-payments", token).send({
      ...body,
      details: {
        holder: {},
        email: "not-an-email",
        phone: "abc",
        count: 1.5,
        enabled: "true",
        short: "abcd",
      },
    });
    expect(invalid.status).toBe(422);
    expect(invalid.body.errors).toEqual({
      "details.holder": "holder must be a string",
      "details.email": "email must be a valid email",
      "details.phone": "phone must be a valid phone",
      "details.count": "count must be an integer",
      "details.enabled": "enabled must be a boolean",
      "details.short": "short must have at most 3 characters",
    });
  });

  it("normalizes details, omitting optional null values", async () => {
    const currency = await createCurrency();
    const type = await createMethodPaymentType({
      code: "FULL",
      currency_id: currency.id,
      fields: FULL_FIELDS,
    });
    const token = await tokenFor("admin");

    const response = await as("post", "/method-payments", token).send({
      method_payment_type_id: type.id,
      label: "Método completo",
      details: {
        holder: "  Farmamad C.A.  ",
        email: "  pagos@farmamad.com  ",
        phone: " 0414-1234567 ",
        count: "12",
        enabled: false,
        short: null,
      },
    });

    expect(response.status).toBe(201);
    expect(response.body.details).toEqual({
      holder: "Farmamad C.A.",
      email: "pagos@farmamad.com",
      phone: "0414-1234567",
      count: 12,
      enabled: false,
    });
  });

  it("rejects a duplicated label inside the same type ignoring case", async () => {
    const currency = await createCurrency();
    const firstType = await createMethodPaymentType({
      code: "PAYPAL",
      currency_id: currency.id,
      fields: PAYPAL_FIELDS,
    });
    const secondType = await createMethodPaymentType({
      code: "PAYPAL_2",
      currency_id: currency.id,
      fields: PAYPAL_FIELDS,
    });
    const token = await tokenFor("admin");
    const body = {
      method_payment_type_id: firstType.id,
      label: "PayPal Farmamad",
      details: { email: "pagos@farmamad.com" },
    };

    const first = await as("post", "/method-payments", token).send(body);
    expect(first.status).toBe(201);

    const duplicate = await as("post", "/method-payments", token).send({
      ...body,
      label: "paypal farmamad",
    });
    expect(duplicate.status).toBe(409);
    expect(duplicate.body).toEqual({
      message: "Payment method already exists",
    });

    const otherType = await as("post", "/method-payments", token).send({
      ...body,
      method_payment_type_id: secondType.id,
    });
    expect(otherType.status).toBe(201);
  });
});
