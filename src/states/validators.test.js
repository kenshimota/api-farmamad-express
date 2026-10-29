const {
  stateSchema,
  MAX_NAME_LENGTH,
  MAX_CODE_LENGTH,
  MIN_NAME_LENGTH,
  MIN_CODE_LENGTH,
  parseStateId,
  REQUIRED_STATE_FIELDS,
} = require("./validators");
const { formatValidationErrors } = require("../auth/validators");

const VALID = { name: "Aragua", code: "VE-D" };

/**
 * Validates a body with the state schema and the same options used by the
 * request middleware.
 * @param {object} body - Request body.
 * @returns {Promise<object>} The validated data.
 */
function validate(body) {
  return stateSchema.validate(body, {
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

describe("stateSchema", () => {
  it("accepts a valid state, trims the name and uppercases the code", async () => {
    await expect(
      validate({ name: "  Aragua  ", code: " ve-d " }),
    ).resolves.toEqual(VALID);
  });

  it("accepts the minimum and maximum documented lengths", async () => {
    await expect(
      validate({
        name: "a".repeat(MIN_NAME_LENGTH),
        code: "A".repeat(MIN_CODE_LENGTH),
      }),
    ).resolves.toEqual({
      name: "a".repeat(MIN_NAME_LENGTH),
      code: "A".repeat(MIN_CODE_LENGTH),
    });
    await expect(
      validate({
        name: "a".repeat(MAX_NAME_LENGTH),
        code: "A".repeat(MAX_CODE_LENGTH),
      }),
    ).resolves.toEqual({
      name: "a".repeat(MAX_NAME_LENGTH),
      code: "A".repeat(MAX_CODE_LENGTH),
    });
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
    ["name is empty", { ...VALID, name: "   " }],
    ["name is too short", { ...VALID, name: "A" }],
    ["name is not text", { ...VALID, name: { a: 1 } }],
    ["name is a number", { ...VALID, name: 123 }],
    ["name exceeds 100 characters", { ...VALID, name: "a".repeat(101) }],
  ])("rejects when %s", async (_case, body) => {
    await expect(errorsFor(body)).resolves.toEqual({
      name: "Nombre inválido",
    });
  });

  it.each([
    ["code is empty", { ...VALID, code: "   " }],
    ["code is too short", { ...VALID, code: "V" }],
    ["code is not text", { ...VALID, code: { a: 1 } }],
    ["code is a number", { ...VALID, code: 123 }],
    ["code exceeds 10 characters", { ...VALID, code: "V".repeat(11) }],
  ])("rejects when %s", async (_case, body) => {
    await expect(errorsFor(body)).resolves.toEqual({
      code: "Código inválido",
    });
  });
});

describe("REQUIRED_STATE_FIELDS", () => {
  it("lists name and code as the required fields", () => {
    expect(REQUIRED_STATE_FIELDS).toEqual(["name", "code"]);
  });
});

describe("parseStateId", () => {
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
    expect(parseStateId(value)).toBe(expected);
  });
});
