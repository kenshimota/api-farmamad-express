const {
  citySchema,
  MAX_NAME_LENGTH,
  MIN_NAME_LENGTH,
  parseCityId,
  REQUIRED_CITY_FIELDS,
} = require("./validators");
const { formatValidationErrors } = require("../auth/validators");

const VALID = { name: "Maracay", state_id: 4 };

/**
 * Validates a body with the city schema and the same options used by the
 * request middleware.
 * @param {object} body - Request body.
 * @returns {Promise<object>} The validated data.
 */
function validate(body) {
  return citySchema.validate(body, {
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

describe("citySchema", () => {
  it("accepts a valid city and trims the name", async () => {
    await expect(
      validate({ name: "  Maracay  ", state_id: 4 }),
    ).resolves.toEqual(VALID);
  });

  it("coerces a numeric string state_id", async () => {
    await expect(validate({ name: "Maracay", state_id: "4" })).resolves.toEqual(
      VALID,
    );
  });

  it("accepts a name with the minimum and maximum documented lengths", async () => {
    await expect(
      validate({ name: "a".repeat(MIN_NAME_LENGTH), state_id: 4 }),
    ).resolves.toEqual({ name: "a".repeat(MIN_NAME_LENGTH), state_id: 4 });
    await expect(
      validate({ name: "a".repeat(MAX_NAME_LENGTH), state_id: 4 }),
    ).resolves.toEqual({ name: "a".repeat(MAX_NAME_LENGTH), state_id: 4 });
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
    ["state_id is zero", { ...VALID, state_id: 0 }],
    ["state_id is negative", { ...VALID, state_id: -1 }],
    ["state_id is decimal", { ...VALID, state_id: 1.5 }],
    ["state_id is not numeric", { ...VALID, state_id: "abc" }],
    ["state_id is an object", { ...VALID, state_id: { a: 1 } }],
  ])("rejects when %s", async (_case, body) => {
    await expect(errorsFor(body)).resolves.toEqual({
      state_id: "Invalid state",
    });
  });
});

describe("REQUIRED_CITY_FIELDS", () => {
  it("lists name and state_id as the required fields", () => {
    expect(REQUIRED_CITY_FIELDS).toEqual(["name", "state_id"]);
  });
});

describe("parseCityId", () => {
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
    expect(parseCityId(value)).toBe(expected);
  });
});
