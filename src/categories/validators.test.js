const {
  categorySchema,
  MAX_NAME_LENGTH,
  parseCategoryId,
  REQUIRED_CATEGORY_FIELDS,
} = require("./validators");
const { formatValidationErrors } = require("../auth/validators");

const VALID = { name: "Analgésicos" };

/**
 * Validates a body with the category schema and the same options used by the
 * request middleware.
 * @param {object} body - Request body.
 * @returns {Promise<object>} The validated data.
 */
function validate(body) {
  return categorySchema.validate(body, {
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

describe("categorySchema", () => {
  it("accepts a valid category and trims the name", async () => {
    await expect(validate({ name: "  Analgésicos  " })).resolves.toEqual(VALID);
  });

  it("accepts a name with exactly 100 characters", async () => {
    const name = "a".repeat(MAX_NAME_LENGTH);

    await expect(validate({ name })).resolves.toEqual({ name });
  });

  it("drops unknown and audit fields", async () => {
    const data = await validate({
      ...VALID,
      id: 1,
      createdAt: "2026-09-01",
      updatedAt: "2026-09-01",
      admin: true,
    });

    expect(data).toEqual(VALID);
  });

  it.each([
    ["name is empty", { name: "   " }],
    ["name is not text", { name: { a: 1 } }],
    ["name is a number", { name: 123 }],
    ["name exceeds 100 characters", { name: "a".repeat(101) }],
  ])("rejects when %s", async (_case, body) => {
    await expect(errorsFor(body)).resolves.toEqual({
      name: "Nombre inválido",
    });
  });
});

describe("REQUIRED_CATEGORY_FIELDS", () => {
  it("lists only name as a required field", () => {
    expect(REQUIRED_CATEGORY_FIELDS).toEqual(["name"]);
  });
});

describe("parseCategoryId", () => {
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
    expect(parseCategoryId(value)).toBe(expected);
  });
});
