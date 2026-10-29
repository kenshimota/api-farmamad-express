const { formatValidationErrors } = require("../auth/validators");
const {
  CODE_MESSAGE,
  IS_ACTIVE_MESSAGE,
  MAX_REASON_LENGTH,
  NAME_MESSAGE,
  RATE_DECIMALS_MESSAGE,
  RATE_MAX_MESSAGE,
  RATE_MESSAGE,
  RATE_POSITIVE_MESSAGE,
  REASON_MESSAGE,
  SYMBOL_MESSAGE,
  createCurrencySchema,
  updateCurrencySchema,
} = require("./validators");

const VALID = {
  code: "EUR",
  name: "Euro",
  symbol: "€",
  rate: 970.5,
};

/**
 * Validates a body with the create schema and the production options.
 * @param {object} body - Request body.
 * @returns {Promise<object>} The validated data.
 */
function validateCreate(body) {
  return createCurrencySchema.validate(body, {
    abortEarly: false,
    stripUnknown: true,
  });
}

/**
 * Validates a body with the update schema and the production options.
 * @param {object} body - Request body.
 * @returns {Promise<object>} The validated data.
 */
function validateUpdate(body) {
  return updateCurrencySchema.validate(body, {
    abortEarly: false,
    stripUnknown: true,
  });
}

/**
 * Validates a create body and flattens the yup error like the API does.
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
 * Validates an update body and flattens the yup error like the API does.
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

describe("createCurrencySchema", () => {
  it("accepts a valid currency", async () => {
    await expect(validateCreate(VALID)).resolves.toEqual(VALID);
  });

  it("normalizes the code to uppercase and trims the text fields", async () => {
    await expect(
      validateCreate({
        code: "  eur_2  ",
        name: "  Euro  ",
        symbol: "  €  ",
        rate: "970.50",
      }),
    ).resolves.toEqual({
      code: "EUR_2",
      name: "Euro",
      symbol: "€",
      rate: 970.5,
    });
  });

  it("accepts the minimum and maximum documented rates", async () => {
    await expect(validateCreate({ ...VALID, rate: 0.000001 })).resolves.toEqual(
      { ...VALID, rate: 0.000001 },
    );
    await expect(
      validateCreate({ ...VALID, rate: 999999999999 }),
    ).resolves.toEqual({ ...VALID, rate: 999999999999 });
  });

  it("strips is_base, is_active and audit fields", async () => {
    const data = await validateCreate({
      ...VALID,
      is_base: true,
      is_active: false,
      id: 99,
      createdAt: "2026-10-29",
      updatedAt: "2026-10-29",
    });

    expect(data).toEqual(VALID);
  });

  it.each(["code", "name", "symbol", "rate"])(
    "rejects a missing %s",
    async (field) => {
      const body = { ...VALID };
      delete body[field];

      await expect(validateCreate(body)).rejects.toThrow();
    },
  );

  it.each([["A"], ["EUR-1"], ["EURO TOO LONG"], ["eur!"], [""], [null]])(
    "rejects the code %p",
    async (code) => {
      await expect(createErrors({ ...VALID, code })).resolves.toEqual({
        code: CODE_MESSAGE,
      });
    },
  );

  it.each([["E"], ["x".repeat(101)], [5], [null]])(
    "rejects the name %p",
    async (name) => {
      await expect(createErrors({ ...VALID, name })).resolves.toEqual({
        name: NAME_MESSAGE,
      });
    },
  );

  it.each([[""], ["   "], ["x".repeat(11)], [5], [null]])(
    "rejects the symbol %p",
    async (symbol) => {
      await expect(createErrors({ ...VALID, symbol })).resolves.toEqual({
        symbol: SYMBOL_MESSAGE,
      });
    },
  );

  it.each([
    [0],
    [-1],
    [0.0000001],
    [1000000000000],
    ["abc"],
    [true],
    [{}],
    [null],
  ])("rejects the rate %p", async (rate) => {
    await expect(createErrors({ ...VALID, rate })).resolves.not.toBeNull();
  });

  it("uses the documented rate messages", async () => {
    await expect(createErrors({ ...VALID, rate: 0 })).resolves.toEqual({
      rate: RATE_POSITIVE_MESSAGE,
    });
    await expect(createErrors({ ...VALID, rate: -1 })).resolves.toEqual({
      rate: RATE_POSITIVE_MESSAGE,
    });
    await expect(createErrors({ ...VALID, rate: 0.0000001 })).resolves.toEqual({
      rate: RATE_DECIMALS_MESSAGE,
    });
    await expect(
      createErrors({ ...VALID, rate: 1000000000000 }),
    ).resolves.toEqual({ rate: RATE_MAX_MESSAGE });
    await expect(createErrors({ ...VALID, rate: "abc" })).resolves.toEqual({
      rate: RATE_MESSAGE,
    });
  });
});

describe("updateCurrencySchema", () => {
  it("keeps only the provided fields without defaults", async () => {
    await expect(validateUpdate({})).resolves.toEqual({});
    await expect(validateUpdate({ rate: 1005.75 })).resolves.toEqual({
      rate: 1005.75,
    });
  });

  it("accepts name, symbol, is_active and reason", async () => {
    await expect(
      validateUpdate({
        name: "  Tether  ",
        symbol: "  USDT  ",
        is_active: true,
        reason: "  Actualización  ",
      }),
    ).resolves.toEqual({
      name: "Tether",
      symbol: "USDT",
      is_active: true,
      reason: "Actualización",
    });
  });

  it("turns a blank reason into null", async () => {
    await expect(validateUpdate({ reason: "   " })).resolves.toEqual({
      reason: null,
    });
  });

  it("rejects text is_active values instead of casting them", async () => {
    await expect(updateErrors({ is_active: "true" })).resolves.toEqual({
      is_active: IS_ACTIVE_MESSAGE,
    });
    await expect(updateErrors({ is_active: 1 })).resolves.toEqual({
      is_active: IS_ACTIVE_MESSAGE,
    });
  });

  it("rejects a reason longer than 255 characters", async () => {
    await expect(
      updateErrors({ reason: "x".repeat(MAX_REASON_LENGTH + 1) }),
    ).resolves.toEqual({ reason: REASON_MESSAGE });
  });

  it("rejects the same invalid fields as the create schema", async () => {
    await expect(updateErrors({ name: "A" })).resolves.toEqual({
      name: NAME_MESSAGE,
    });
    await expect(updateErrors({ symbol: "" })).resolves.toEqual({
      symbol: SYMBOL_MESSAGE,
    });
    await expect(updateErrors({ rate: 0 })).resolves.toEqual({
      rate: RATE_POSITIVE_MESSAGE,
    });
  });

  it("strips code and is_base because they are immutable", async () => {
    await expect(
      validateUpdate({ code: "USD", is_base: true, rate: 2 }),
    ).resolves.toEqual({ rate: 2 });
  });
});
