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

describe("POST /method-payments with a real database", () => {
  it("creates a PayPal method with JSONB details and the inherited currency", async () => {
    const currency = await createCurrency();
    const type = await createMethodPaymentType({
      code: "PAYPAL",
      currency_id: currency.id,
      fields: PAYPAL_FIELDS,
    });
    const token = await tokenFor("admin");

    const response = await as("post", "/method-payments", token).send({
      method_payment_type_id: type.id,
      label: "  PayPal Farmamad  ",
      details: { email: "  pagos@farmamad.com  " },
      currency_id: 999,
      currency: { id: 999 },
    });

    expect(response.status).toBe(201);
    expect(response.body).toEqual({
      id: expect.any(Number),
      method_payment_type_id: type.id,
      label: "PayPal Farmamad",
      details: { email: "pagos@farmamad.com" },
      is_active: true,
      currency_id: currency.id,
      currency: {
        id: currency.id,
        code: currency.code,
        name: currency.name,
        symbol: currency.symbol,
      },
      method_payment_type: {
        id: type.id,
        code: "PAYPAL",
        name: type.name,
      },
    });
    expect(response.body).not.toHaveProperty("createdAt");
    expect(response.body).not.toHaveProperty("updatedAt");

    const stored = await MethodPayment.findByPk(response.body.id);
    expect(stored.details).toEqual({ email: "pagos@farmamad.com" });
    expect(stored.is_active).toBe(true);
  });

  it("creates bank, Binance and mobile payment details", async () => {
    const currency = await createCurrency();
    const fields = [
      { key: "bank_name", label: "Banco", type: "text", required: true },
      { key: "account_number", label: "Cuenta", type: "text", required: true },
      { key: "wallet_address", label: "Wallet", type: "text", required: true },
      { key: "network", label: "Red", type: "text", required: true },
      { key: "phone", label: "Teléfono", type: "phone", required: true },
    ];
    const type = await createMethodPaymentType({
      code: "MIXED",
      currency_id: currency.id,
      fields,
    });
    const token = await tokenFor("admin");
    const details = {
      bank_name: "Banesco",
      account_number: "01340000000000000000",
      wallet_address: "T-123",
      network: "TRC20",
      phone: "04141234567",
    };

    const response = await as("post", "/method-payments", token).send({
      method_payment_type_id: type.id,
      label: "Cuenta mixta",
      details,
    });

    expect(response.status).toBe(201);
    expect(response.body.details).toEqual(details);
  });

  it("responds 400 when required fields are missing", async () => {
    const token = await tokenFor("admin");

    const response = await as("post", "/method-payments", token).send({});

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      message: "method_payment_type_id, label and details are required",
    });
  });

  it("responds 422 for a missing, inactive or unusable type", async () => {
    const token = await tokenFor("admin");
    const currency = await createCurrency();

    const missing = await as("post", "/method-payments", token).send({
      method_payment_type_id: 999999,
      label: "PayPal",
      details: { email: "pagos@farmamad.com" },
    });
    expect(missing.status).toBe(422);
    expect(missing.body).toEqual({
      errors: { method_payment_type_id: "Invalid payment type" },
    });

    const inactiveType = await createMethodPaymentType({
      code: "INACTIVE",
      currency_id: currency.id,
      fields: PAYPAL_FIELDS,
      is_active: false,
    });
    const inactive = await as("post", "/method-payments", token).send({
      method_payment_type_id: inactiveType.id,
      label: "PayPal",
      details: { email: "pagos@farmamad.com" },
    });
    expect(inactive.status).toBe(422);
    expect(inactive.body).toEqual({
      errors: { method_payment_type_id: "Invalid payment type" },
    });

    const inactiveCurrency = await createCurrency({ is_active: false });
    const typeWithInactiveCurrency = await createMethodPaymentType({
      code: "NO_CURRENCY",
      currency_id: inactiveCurrency.id,
      fields: PAYPAL_FIELDS,
    });
    const currencyResponse = await as("post", "/method-payments", token).send({
      method_payment_type_id: typeWithInactiveCurrency.id,
      label: "PayPal",
      details: { email: "pagos@farmamad.com" },
    });
    expect(currencyResponse.status).toBe(422);
    expect(currencyResponse.body).toEqual({
      errors: { method_payment_type_id: "Invalid payment type" },
    });
  });
});
