const { formatValidationErrors } = require("../auth/validators");
const {
  CODE_MESSAGE,
  DESCRIPTION_MESSAGE,
  IS_ACTIVE_MESSAGE,
  IS_ACTIVE_FILTER_MESSAGE,
  NAME_MESSAGE,
  RATE_DECIMALS_MESSAGE,
  RATE_MESSAGE,
  RATE_RANGE_MESSAGE,
  REQUIRED_TAX_FIELDS,
  UPDATE_TAX_FIELDS,
  createTaxSchema,
  updateTaxSchema,
} = require("./validators");
const { parseBooleanFlag, parseTaxId } = require("./parsers");

const VALID = {
  code: "IVA",
  name: "Impuesto al Valor Agregado",
  rate: 16,
};

/**
 * Validates a body with the create schema and the production options.
 * @param {object} body - Request body.
 * @returns {Promise<object>} The validated data.
 */
function validateCreate(body) {
  return createTaxSchema.validate(body, {
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
  return updateTaxSchema.validate(body, {
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

describe("tax validators", () => {
  it("exposes the required and editable fields", () => {
    expect(REQUIRED_TAX_FIELDS).toEqual(["code", "name", "rate"]);
    expect(UPDATE_TAX_FIELDS).toEqual([
      "name",
      "rate",
      "description",
      "is_active",
    ]);
  });
});

describe("createTaxSchema", () => {
  it("accepts a valid tax with the documented defaults", async () => {
    await expect(validateCreate(VALID)).resolves.toEqual({
      ...VALID,
      description: null,
      is_active: true,
    });
  });

  it("normalizes the code to uppercase and trims the text fields", async () => {
    await expect(
      validateCreate({
        code: "  iva_2  ",
        name: "  IVA general  ",
        rate: "16.50",
        description: "  Impuesto general  ",
      }),
    ).resolves.toEqual({
      code: "IVA_2",
      name: "IVA general",
      rate: 16.5,
      description: "Impuesto general",
      is_active: true,
    });
  });

  it("accepts the range boundaries and two decimals", async () => {
    await expect(validateCreate({ ...VALID, rate: 0 })).resolves.toEqual(
      expect.objectContaining({ rate: 0 }),
    );
    await expect(validateCreate({ ...VALID, rate: 100 })).resolves.toEqual(
      expect.objectContaining({ rate: 100 }),
    );
    await expect(validateCreate({ ...VALID, rate: 3.55 })).resolves.toEqual(
      expect.objectContaining({ rate: 3.55 }),
    );
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

  it.each([["A"], ["IVA-1"], ["IVA!"], ["x".repeat(21)], [""], [null]])(
    "rejects the code %p",
    async (code) => {
      await expect(createErrors({ ...VALID, code })).resolves.toEqual({
        code: CODE_MESSAGE,
      });
    },
  );

  it.each([["I"], ["x".repeat(101)], [5], [null]])(
    "rejects the name %p",
    async (name) => {
      await expect(createErrors({ ...VALID, name })).resolves.toEqual({
        name: NAME_MESSAGE,
      });
    },
  );

  it.each([[-0.01], [-1], [100.01], [101]])(
    "rejects the out-of-range rate %p",
    async (rate) => {
      await expect(createErrors({ ...VALID, rate })).resolves.toEqual({
        rate: RATE_RANGE_MESSAGE,
      });
    },
  );

  it.each([[16.123], ["16.123"]])(
    "rejects the rate %p with more than two decimals",
    async (rate) => {
      await expect(createErrors({ ...VALID, rate })).resolves.toEqual({
        rate: RATE_DECIMALS_MESSAGE,
      });
    },
  );

  it.each([["abc"], [true], [{}], [null]])(
    "rejects the non-numeric rate %p",
    async (rate) => {
      await expect(createErrors({ ...VALID, rate })).resolves.toEqual({
        rate: RATE_MESSAGE,
      });
    },
  );

  it("rejects a description longer than 255 characters", async () => {
    await expect(
      createErrors({ ...VALID, description: "x".repeat(256) }),
    ).resolves.toEqual({ description: DESCRIPTION_MESSAGE });
  });

  it("rejects text is_active values instead of casting them", async () => {
    await expect(
      createErrors({ ...VALID, is_active: "true" }),
    ).resolves.toEqual({ is_active: IS_ACTIVE_MESSAGE });
    await expect(createErrors({ ...VALID, is_active: 1 })).resolves.toEqual({
      is_active: IS_ACTIVE_MESSAGE,
    });
  });
});

describe("updateTaxSchema", () => {
  it("keeps only the provided fields without defaults", async () => {
    await expect(validateUpdate({})).resolves.toEqual({});
    await expect(validateUpdate({ rate: 3.5 })).resolves.toEqual({ rate: 3.5 });
  });

  it("accepts the editable fields and trims them", async () => {
    await expect(
      validateUpdate({
        name: "  IGTF  ",
        rate: "3.50",
        description: "  General  ",
        is_active: false,
      }),
    ).resolves.toEqual({
      name: "IGTF",
      rate: 3.5,
      description: "General",
      is_active: false,
    });
  });

  it("turns a blank description into null", async () => {
    await expect(validateUpdate({ description: "   " })).resolves.toEqual({
      description: null,
    });
  });

  it("ignores code because it is immutable", async () => {
    await expect(validateUpdate({ code: "OTHER", rate: 5 })).resolves.toEqual({
      rate: 5,
    });
  });

  it("rejects invalid editable fields", async () => {
    await expect(updateErrors({ name: "A" })).resolves.toEqual({
      name: NAME_MESSAGE,
    });
    await expect(updateErrors({ rate: 101 })).resolves.toEqual({
      rate: RATE_RANGE_MESSAGE,
    });
    await expect(updateErrors({ rate: 3.555 })).resolves.toEqual({
      rate: RATE_DECIMALS_MESSAGE,
    });
    await expect(updateErrors({ is_active: "false" })).resolves.toEqual({
      is_active: IS_ACTIVE_MESSAGE,
    });
  });
});

describe("tax parsers", () => {
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
  ])("parses the tax id %p as %p", (value, expected) => {
    expect(parseTaxId(value)).toBe(expected);
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

  it("exposes the documented filter message", () => {
    expect(IS_ACTIVE_FILTER_MESSAGE).toBe("Invalid is_active");
  });
});
