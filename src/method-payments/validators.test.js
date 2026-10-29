const { formatValidationErrors } = require("../auth/validators");
const {
  REQUIRED_METHOD_PAYMENT_FIELDS,
  UPDATE_METHOD_PAYMENT_FIELDS,
} = require("./fields");
const {
  createMethodPaymentSchema,
  updateMethodPaymentSchema,
} = require("./validators");
const {
  parseBooleanFlag,
  parseMethodPaymentId,
  parsePositiveInteger,
} = require("./parsers");

const VALID = {
  method_payment_type_id: 1,
  label: "PayPal Farmamad",
  details: { email: "pagos@farmamad.com" },
};

/**
 * Validates a body with the create schema and production options.
 * @param {object} body - Request body.
 * @returns {Promise<object>} The validated data.
 */
function validateCreate(body) {
  return createMethodPaymentSchema.validate(body, {
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
  return updateMethodPaymentSchema.validate(body, {
    abortEarly: false,
    stripUnknown: true,
  });
}

/**
 * Validates a create body and flattens the yup error.
 * @param {object} body - Request body.
 * @returns {Promise<Record<string, string>|null>} Error map or null.
 */
async function createErrors(body) {
  try {
    await validateCreate(body);

    return null;
  } catch (error) {
    return formatValidationErrors(error);
  }
}

/**
 * Validates an update body and flattens the yup error.
 * @param {object} body - Request body.
 * @returns {Promise<Record<string, string>|null>} Error map or null.
 */
async function updateErrors(body) {
  try {
    await validateUpdate(body);

    return null;
  } catch (error) {
    return formatValidationErrors(error);
  }
}

describe("method payment field contract", () => {
  it("exposes required and editable fields", () => {
    expect(REQUIRED_METHOD_PAYMENT_FIELDS).toEqual([
      "method_payment_type_id",
      "label",
      "details",
    ]);
    expect(UPDATE_METHOD_PAYMENT_FIELDS).toEqual([
      "label",
      "details",
      "is_active",
    ]);
  });
});

describe("createMethodPaymentSchema", () => {
  it("accepts a valid method and applies the defaults", async () => {
    await expect(validateCreate(VALID)).resolves.toEqual({
      ...VALID,
      is_active: true,
    });
  });

  it("trims the label and strips unknown top-level fields", async () => {
    await expect(
      validateCreate({
        ...VALID,
        label: "  PayPal Farmamad  ",
        currency_id: 99,
        currency: { id: 99 },
        id: 99,
        createdAt: "2026-10-29",
      }),
    ).resolves.toEqual({
      ...VALID,
      label: "PayPal Farmamad",
      is_active: true,
    });
  });

  it("rejects an invalid method_payment_type_id", async () => {
    await expect(
      createErrors({ ...VALID, method_payment_type_id: "abc" }),
    ).resolves.toEqual({
      method_payment_type_id: "Invalid payment type",
    });
    await expect(
      createErrors({ ...VALID, method_payment_type_id: 0 }),
    ).resolves.toEqual({
      method_payment_type_id: "Invalid payment type",
    });
  });

  it.each([[""], ["   "], ["x".repeat(101)], [5], [null]])(
    "rejects the label %p",
    async (label) => {
      await expect(createErrors({ ...VALID, label })).resolves.toEqual({
        label: "label must be between 1 and 100 characters",
      });
    },
  );

  it.each([[[]], ["text"], [null], [42]])(
    "rejects the non-object details %p",
    async (details) => {
      await expect(createErrors({ ...VALID, details })).resolves.toEqual({
        details: "details must be an object",
      });
    },
  );

  it("rejects a non-boolean is_active instead of casting it", async () => {
    await expect(
      createErrors({ ...VALID, is_active: "true" }),
    ).resolves.toEqual({ is_active: "is_active must be a boolean" });
    await expect(createErrors({ ...VALID, is_active: 1 })).resolves.toEqual({
      is_active: "is_active must be a boolean",
    });
  });
});

describe("updateMethodPaymentSchema", () => {
  it("keeps only the provided fields without defaults", async () => {
    await expect(validateUpdate({})).resolves.toEqual({});
    await expect(validateUpdate({ label: "PayPal" })).resolves.toEqual({
      label: "PayPal",
    });
  });

  it("accepts label, details, is_active and method_payment_type_id", async () => {
    await expect(
      validateUpdate({
        method_payment_type_id: "2",
        label: "  PayPal principal  ",
        details: { email: "tesoreria@farmamad.com" },
        is_active: false,
      }),
    ).resolves.toEqual({
      method_payment_type_id: 2,
      label: "PayPal principal",
      details: { email: "tesoreria@farmamad.com" },
      is_active: false,
    });
  });

  it("rejects invalid editable fields", async () => {
    await expect(updateErrors({ label: "   " })).resolves.toEqual({
      label: "label must be between 1 and 100 characters",
    });
    await expect(updateErrors({ details: [] })).resolves.toEqual({
      details: "details must be an object",
    });
    await expect(updateErrors({ is_active: "false" })).resolves.toEqual({
      is_active: "is_active must be a boolean",
    });
    await expect(
      updateErrors({ method_payment_type_id: "abc" }),
    ).resolves.toEqual({ method_payment_type_id: "Invalid payment type" });
  });

  it("ignores currency fields", async () => {
    await expect(
      validateUpdate({ label: "PayPal", currency_id: 3, currency: {} }),
    ).resolves.toEqual({ label: "PayPal" });
  });
});

describe("method payment parsers", () => {
  it.each([
    [1, 1],
    ["2", 2],
    ["  3  ", 3],
    ["0", null],
    ["-1", null],
    ["1.5", null],
    ["abc", null],
    ["", null],
    [null, null],
    [undefined, null],
    [{}, null],
  ])("parses the id %p as %p", (value, expected) => {
    expect(parsePositiveInteger(value)).toBe(expected);
    expect(parseMethodPaymentId(value)).toBe(expected);
  });

  it.each([
    [true, true],
    [false, false],
    ["true", true],
    [" TRUE ", true],
    ["false", false],
    [" FALSE ", false],
    ["yes", undefined],
    ["", undefined],
    [1, undefined],
    [null, undefined],
    [undefined, undefined],
  ])("parses the boolean flag %p as %p", (value, expected) => {
    expect(parseBooleanFlag(value)).toBe(expected);
  });
});
