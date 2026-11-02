const {
  createPriceListSchema,
  parsePriceListId,
  REQUIRED_PRICE_LIST_FIELDS,
} = require("./validators");
const { formatValidationErrors } = require("../auth/validators");

const VALID = {
  name: "Mayorista 30",
  description: "Margen del 30 % para mayoristas",
  percentage: 30,
};

/**
 * Validates a body with the create schema and the same options used by the
 * request middleware.
 * @param {object} body - Request body.
 * @returns {Promise<object>} The validated data.
 */
function validate(body) {
  return createPriceListSchema.validate(body, {
    abortEarly: false,
    stripUnknown: true,
  });
}

/**
 * Validates a body and flattens the yup error the same way the API does.
 * @param {object} body - Request body.
 * @returns {Promise<Record<string, string>|null>} Error map or null.
 */
async function errorsFor(body) {
  try {
    await validate(body);

    return null;
  } catch (error) {
    return formatValidationErrors(error);
  }
}

describe("createPriceListSchema", () => {
  it("accepts a valid list and trims the text fields", async () => {
    const data = await validate({
      ...VALID,
      name: "  Mayorista 30  ",
      description: "  Margen del 30 % para mayoristas  ",
    });

    expect(data).toEqual(VALID);
  });

  it("accepts a missing or blank description as null", async () => {
    await expect(
      validate({ name: "Mayorista", percentage: 0 }),
    ).resolves.toEqual({ name: "Mayorista", percentage: 0 });

    await expect(
      validate({ name: "Mayorista", description: "   ", percentage: 0 }),
    ).resolves.toEqual({ name: "Mayorista", description: null, percentage: 0 });
  });

  it("accepts percentage 0 and values with two decimals", async () => {
    await expect(validate({ name: "Base", percentage: 0 })).resolves.toEqual({
      name: "Base",
      percentage: 0,
    });
    await expect(
      validate({ name: "Fino", percentage: 12.34 }),
    ).resolves.toEqual({ name: "Fino", percentage: 12.34 });
  });

  it("drops unknown fields", async () => {
    const data = await validate({ ...VALID, id: 99, cost: 10 });

    expect(data).toEqual(VALID);
  });

  it.each([
    ["blank name", { name: "   " }, "name", "Nombre inválido"],
    ["non-text name", { name: { a: 1 } }, "name", "Nombre inválido"],
    ["too long name", { name: "x".repeat(151) }, "name", "Nombre inválido"],
    [
      "too long description",
      { description: "x".repeat(501) },
      "description",
      "Descripción inválida",
    ],
    [
      "non-text description",
      { description: { a: 1 } },
      "description",
      "Descripción inválida",
    ],
    [
      "negative percentage",
      { percentage: -1 },
      "percentage",
      "Invalid percentage",
    ],
    [
      "non-numeric percentage",
      { percentage: "abc" },
      "percentage",
      "Invalid percentage",
    ],
    [
      "too many decimals",
      { percentage: 12.345 },
      "percentage",
      "Invalid percentage",
    ],
    [
      "percentage 100",
      { percentage: 100 },
      "percentage",
      "percentage must be < 100",
    ],
    [
      "percentage above 100",
      { percentage: 120 },
      "percentage",
      "percentage must be < 100",
    ],
  ])("rejects when the %s", async (_case, overrides, field, message) => {
    const errors = await errorsFor({ ...VALID, ...overrides });

    expect(errors).toEqual({ [field]: message });
  });
});

describe("REQUIRED_PRICE_LIST_FIELDS", () => {
  it("lists the two fields required to create a list", () => {
    expect(REQUIRED_PRICE_LIST_FIELDS).toEqual(["name", "percentage"]);
  });
});

describe("parsePriceListId", () => {
  it.each([
    [1, 1],
    ["2", 2],
    ["  3  ", 3],
    ["0", null],
    ["-1", null],
    ["1.5", null],
    ["abc", null],
    ["", null],
    [0, null],
    [-1, null],
    [1.5, null],
    [null, null],
    [undefined, null],
    [{}, null],
  ])("parses %p as %p", (value, expected) => {
    expect(parsePriceListId(value)).toBe(expected);
  });
});
