const {
  createCustomerSchema,
  parseCustomerId,
  REQUIRED_CUSTOMER_FIELDS,
} = require("./validators");
const { formatValidationErrors } = require("../auth/validators");

const VALID = {
  fullName: "Juan Pérez",
  latitude: -17.7833,
  longitude: -63.1821,
  direction: "Av. Monseñor Rivero 123",
  email: "juan@example.com",
};

/**
 * Validates a body with the create schema and the same options used by the
 * request middleware.
 * @param {object} body - Request body.
 * @returns {Promise<object>} The validated data.
 */
function validate(body) {
  return createCustomerSchema.validate(body, {
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

describe("createCustomerSchema", () => {
  it("accepts a valid customer and trims the text fields", async () => {
    const data = await validate({
      ...VALID,
      fullName: "  Juan Pérez  ",
      direction: "  Av. Monseñor Rivero 123  ",
      email: "  juan@example.com  ",
    });

    expect(data).toEqual(VALID);
  });

  it("accepts isRegistered as a boolean", async () => {
    await expect(validate({ ...VALID, isRegistered: true })).resolves.toEqual({
      ...VALID,
      isRegistered: true,
    });
  });

  it("drops unknown fields", async () => {
    const data = await validate({ ...VALID, isRegistered: true, admin: true });

    expect(data).toEqual({ ...VALID, isRegistered: true });
  });

  it.each([
    ["fullName is empty", { fullName: "   " }, "fullName", "Nombre inválido"],
    [
      "fullName is not text",
      { fullName: { a: 1 } },
      "fullName",
      "Nombre inválido",
    ],
    [
      "latitude is not a number",
      { latitude: "norte" },
      "latitude",
      "Latitud inválida",
    ],
    [
      "latitude is below -90",
      { latitude: -90.1 },
      "latitude",
      "Latitud inválida",
    ],
    [
      "latitude is above 90",
      { latitude: 90.1 },
      "latitude",
      "Latitud inválida",
    ],
    [
      "longitude is not a number",
      { longitude: "este" },
      "longitude",
      "Longitud inválida",
    ],
    [
      "longitude is below -180",
      { longitude: -180.1 },
      "longitude",
      "Longitud inválida",
    ],
    [
      "longitude is above 180",
      { longitude: 180.1 },
      "longitude",
      "Longitud inválida",
    ],
    [
      "direction is empty",
      { direction: "   " },
      "direction",
      "Dirección inválida",
    ],
    [
      "direction is not text",
      { direction: { a: 1 } },
      "direction",
      "Dirección inválida",
    ],
    ["email is malformed", { email: "invalid@" }, "email", "Email inválido"],
    ["email is empty", { email: "   " }, "email", "Email inválido"],
    ["email is not text", { email: { a: 1 } }, "email", "Email inválido"],
  ])("rejects when %s", async (_case, overrides, field, message) => {
    const errors = await errorsFor({ ...VALID, ...overrides });

    expect(errors).toEqual({ [field]: message });
  });

  it("rejects isRegistered when it is not a boolean", async () => {
    const errors = await errorsFor({ ...VALID, isRegistered: "true" });

    expect(errors).toEqual({ isRegistered: "isRegistered must be a boolean" });
  });
});

describe("REQUIRED_CUSTOMER_FIELDS", () => {
  it("lists the five fields required to create a customer", () => {
    expect(REQUIRED_CUSTOMER_FIELDS).toEqual([
      "fullName",
      "latitude",
      "longitude",
      "direction",
      "email",
    ]);
  });
});

describe("parseCustomerId", () => {
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
    expect(parseCustomerId(value)).toBe(expected);
  });
});
