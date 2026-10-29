const { formatValidationErrors } = require("../auth/validators");
const {
  CODE_MESSAGE,
  CURRENCY_FILTER_MESSAGE,
  DESCRIPTION_MESSAGE,
  IS_ACTIVE_FILTER_MESSAGE,
  IS_ACTIVE_MESSAGE,
  NAME_MESSAGE,
  REQUIRED_METHOD_PAYMENT_TYPE_FIELDS,
  UPDATE_METHOD_PAYMENT_TYPE_FIELDS,
  createMethodPaymentTypeSchema,
  updateMethodPaymentTypeSchema,
} = require("./validators");

const VALID_FIELD = Object.freeze({
  key: "email",
  label: "Correo de PayPal",
  type: "email",
  required: true,
});

const VALID = Object.freeze({
  code: "PAYPAL",
  name: "PayPal",
  currency_id: 3,
  fields: [VALID_FIELD],
});

/**
 * Validates a body with the create schema and production options.
 * @param {object} body - Request body.
 * @returns {Promise<object>} The validated data.
 */
function validateCreate(body) {
  return createMethodPaymentTypeSchema.validate(body, {
    abortEarly: false,
    stripUnknown: true,
  });
}

/**
 * Validates a body with the update schema and production options.
 * @param {object} body - Request body.
 * @returns {Promise<object>} The validated data.
 */
function validateUpdate(body) {
  return updateMethodPaymentTypeSchema.validate(body, {
    abortEarly: false,
    stripUnknown: true,
  });
}

/**
 * Flattens the validation error of a schema.
 * @param {Function} validate - Validation function.
 * @param {object} body - Request body.
 * @returns {Promise<Record<string, string>|null>} Error map or null.
 */
async function errorsFrom(validate, body) {
  try {
    await validate(body);

    return null;
  } catch (error) {
    return formatValidationErrors(error);
  }
}

describe("method payment type field contract", () => {
  it("exposes the required and editable fields", () => {
    expect(REQUIRED_METHOD_PAYMENT_TYPE_FIELDS).toEqual([
      "code",
      "name",
      "currency_id",
    ]);
    expect(UPDATE_METHOD_PAYMENT_TYPE_FIELDS).toEqual([
      "name",
      "currency_id",
      "fields",
      "description",
      "is_active",
    ]);
  });
});

describe("createMethodPaymentTypeSchema", () => {
  it("accepts a valid type and applies the documented defaults", async () => {
    await expect(
      validateCreate({
        code: "paypal",
        name: "PayPal",
        currency_id: 3,
      }),
    ).resolves.toEqual({
      code: "PAYPAL",
      name: "PayPal",
      currency_id: 3,
      fields: [],
      description: null,
      is_active: true,
    });
  });

  it("normalizes the code and trims the text fields", async () => {
    await expect(
      validateCreate({
        ...VALID,
        code: "  pago_movil  ",
        name: "  Pago Móvil  ",
        description: "  Cobros por teléfono  ",
      }),
    ).resolves.toEqual({
      code: "PAGO_MOVIL",
      name: "Pago Móvil",
      currency_id: 3,
      fields: [VALID_FIELD],
      description: "Cobros por teléfono",
      is_active: true,
    });
  });

  it.each([["A"], ["PAYPAL-1"], ["PAYPAL!"], ["x".repeat(31)], [""], [null]])(
    "rejects the code %p",
    async (code) => {
      await expect(
        errorsFrom(validateCreate, { ...VALID, code }),
      ).resolves.toEqual({ code: CODE_MESSAGE });
    },
  );

  it.each([[""], [null], ["x".repeat(101)]])(
    "rejects the name %p",
    async (name) => {
      await expect(
        errorsFrom(validateCreate, { ...VALID, name }),
      ).resolves.toEqual({ name: NAME_MESSAGE });
    },
  );

  it.each([["abc"], [0], [-1], [1.5], [null]])(
    "rejects the currency_id %p",
    async (currencyId) => {
      await expect(
        errorsFrom(validateCreate, { ...VALID, currency_id: currencyId }),
      ).resolves.toEqual({ currency_id: "Invalid currency" });
    },
  );

  it("rejects a description longer than 255 characters", async () => {
    await expect(
      errorsFrom(validateCreate, { ...VALID, description: "x".repeat(256) }),
    ).resolves.toEqual({ description: DESCRIPTION_MESSAGE });
  });

  it("rejects text is_active values instead of casting them", async () => {
    await expect(
      errorsFrom(validateCreate, { ...VALID, is_active: "true" }),
    ).resolves.toEqual({ is_active: IS_ACTIVE_MESSAGE });
    await expect(
      errorsFrom(validateCreate, { ...VALID, is_active: 1 }),
    ).resolves.toEqual({ is_active: IS_ACTIVE_MESSAGE });
  });

  it("strips unknown and audit fields", async () => {
    await expect(
      validateCreate({
        ...VALID,
        id: 9,
        createdAt: "2026-10-29",
        updatedAt: "2026-10-29",
      }),
    ).resolves.toEqual({
      ...VALID,
      description: null,
      is_active: true,
    });
  });
});

describe("updateMethodPaymentTypeSchema", () => {
  it("keeps only the provided fields without defaults", async () => {
    await expect(validateUpdate({})).resolves.toEqual({});
    await expect(validateUpdate({ name: "  Banco  " })).resolves.toEqual({
      name: "Banco",
    });
  });

  it("accepts currency_id and fields for immutable checks", async () => {
    await expect(
      validateUpdate({ currency_id: "5", fields: [VALID_FIELD] }),
    ).resolves.toEqual({ currency_id: 5, fields: [VALID_FIELD] });
  });

  it("ignores code because it is immutable", async () => {
    await expect(
      validateUpdate({ code: "OTHER", name: "Banco" }),
    ).resolves.toEqual({ name: "Banco" });
  });

  it("turns a blank description into null", async () => {
    await expect(validateUpdate({ description: "   " })).resolves.toEqual({
      description: null,
    });
  });

  it("rejects invalid editable fields", async () => {
    await expect(errorsFrom(validateUpdate, { name: "" })).resolves.toEqual({
      name: NAME_MESSAGE,
    });
    await expect(
      errorsFrom(validateUpdate, { currency_id: 0 }),
    ).resolves.toEqual({ currency_id: "Invalid currency" });
    await expect(
      errorsFrom(validateUpdate, {
        fields: [{ ...VALID_FIELD, key: "A" }],
      }),
    ).resolves.toEqual({ fields: "Invalid fields definition" });
    await expect(
      errorsFrom(validateUpdate, { is_active: "false" }),
    ).resolves.toEqual({ is_active: IS_ACTIVE_MESSAGE });
  });
});

describe("method payment type query messages", () => {
  it("exposes the documented filter messages", () => {
    expect(IS_ACTIVE_FILTER_MESSAGE).toBe("Invalid is_active");
    expect(CURRENCY_FILTER_MESSAGE).toBe("Invalid currency_id");
  });
});
