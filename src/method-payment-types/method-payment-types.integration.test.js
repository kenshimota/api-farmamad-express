process.env.JWT_SECRET = process.env.JWT_SECRET || "integration-test-secret";

const {
  ForeignKeyConstraintError,
  UniqueConstraintError,
} = require("sequelize");
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

describe("POST /method-payment-types with a real database", () => {
  it("creates a type, normalizes the code and defaults fields and is_active", async () => {
    const currency = await createCurrency();
    const token = await tokenFor("admin");

    const response = await as("post", "/method-payment-types", token).send({
      code: " paypal ",
      name: "PayPal",
      currency_id: currency.id,
      description: "Pagos por PayPal",
    });

    expect(response.status).toBe(201);
    expect(response.body).toEqual({
      id: expect.any(Number),
      code: "PAYPAL",
      name: "PayPal",
      currency_id: currency.id,
      currency: {
        id: currency.id,
        code: currency.code,
        name: currency.name,
        symbol: currency.symbol,
      },
      fields: [],
      description: "Pagos por PayPal",
      is_active: true,
    });
    expect(response.body).not.toHaveProperty("createdAt");
    expect(response.body).not.toHaveProperty("updatedAt");

    const stored = await MethodPaymentType.findByPk(response.body.id);
    expect(stored.code).toBe("PAYPAL");
    expect(stored.fields).toEqual([]);
    expect(stored.is_active).toBe(true);
  });

  it("persists the fields definition as JSONB", async () => {
    const currency = await createCurrency();
    const token = await tokenFor("admin");

    const response = await as("post", "/method-payment-types", token).send({
      code: "PAYPAL",
      name: "PayPal",
      currency_id: currency.id,
      fields: [FIELD],
    });

    expect(response.status).toBe(201);
    expect(response.body.fields).toEqual([FIELD]);

    const stored = await MethodPaymentType.findByPk(response.body.id);
    expect(stored.fields).toEqual([FIELD]);
  });

  it("rejects a duplicated code ignoring case", async () => {
    const currency = await createCurrency();
    await createMethodPaymentType({ code: "PAYPAL", currency_id: currency.id });
    const token = await tokenFor("admin");

    const response = await as("post", "/method-payment-types", token).send({
      code: "paypal",
      name: "Otro PayPal",
      currency_id: currency.id,
    });

    expect(response.status).toBe(409);
    expect(response.body).toEqual({
      message: "Payment type already exists",
    });
  });

  it("enforces the functional unique index and the currency foreign key", async () => {
    const currency = await createCurrency();
    await createMethodPaymentType({ code: "PAYPAL", currency_id: currency.id });

    await expect(
      MethodPaymentType.create({
        code: "paypal",
        name: "Duplicado",
        currency_id: currency.id,
      }),
    ).rejects.toThrow(UniqueConstraintError);

    await expect(
      MethodPaymentType.create({
        code: "ORPHAN",
        name: "Sin moneda",
        currency_id: 999999,
      }),
    ).rejects.toThrow(ForeignKeyConstraintError);
  });

  it("responds 400, 422 and 422 Invalid currency", async () => {
    const token = await tokenFor("admin");

    const missing = await as("post", "/method-payment-types", token).send({});
    expect(missing.status).toBe(400);
    expect(missing.body).toEqual({
      message: "code, name and currency_id are required",
    });

    const invalidCode = await as("post", "/method-payment-types", token).send({
      code: "A",
      name: "Inválido",
      currency_id: 1,
    });
    expect(invalidCode.status).toBe(422);
    expect(invalidCode.body).toEqual({
      errors: { code: expect.stringContaining("code") },
    });

    const invalidFields = await as("post", "/method-payment-types", token).send(
      {
        code: "FIELDS",
        name: "Campos inválidos",
        currency_id: 1,
        fields: [{ ...FIELD, unknown: true }],
      },
    );
    expect(invalidFields.status).toBe(422);
    expect(invalidFields.body).toEqual({
      errors: { fields: "Invalid fields definition" },
    });

    const invalidCurrency = await as(
      "post",
      "/method-payment-types",
      token,
    ).send({
      code: "ORPHAN",
      name: "Sin moneda",
      currency_id: 999999,
    });
    expect(invalidCurrency.status).toBe(422);
    expect(invalidCurrency.body).toEqual({
      errors: { currency_id: "Invalid currency" },
    });
  });

  it("rejects an inactive currency", async () => {
    const currency = await createCurrency({ is_active: false });
    const token = await tokenFor("admin");

    const response = await as("post", "/method-payment-types", token).send({
      code: "INACTIVE",
      name: "Moneda inactiva",
      currency_id: currency.id,
    });

    expect(response.status).toBe(422);
    expect(response.body).toEqual({
      errors: { currency_id: "Invalid currency" },
    });
  });
});
