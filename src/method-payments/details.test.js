const { validateDetails, isPlainObject } = require("./details");

const PAYPAL_FIELDS = [
  { key: "email", label: "Correo", type: "email", required: true },
];

/**
 * Builds a field definition with the documented defaults.
 * @param {object} overrides - Field overrides.
 * @returns {object} The field definition.
 */
function field(overrides) {
  return {
    key: "value",
    label: "Valor",
    type: "text",
    required: false,
    ...overrides,
  };
}

describe("isPlainObject", () => {
  it.each([
    [{}, true],
    [{ a: 1 }, true],
    [null, false],
    [undefined, false],
    [[], false],
    ["text", false],
    [1, false],
  ])("classifies %p as %p", (value, expected) => {
    expect(isPlainObject(value)).toBe(expected);
  });
});

describe("validateDetails", () => {
  it("trims text fields and normalizes the documented types", () => {
    const fields = [
      field({ key: "name", type: "text", required: true }),
      field({ key: "email", type: "email", required: true }),
      field({ key: "phone", type: "phone", required: true }),
      field({ key: "count", type: "integer", required: true }),
      field({ key: "enabled", type: "boolean", required: true }),
    ];

    const result = validateDetails(fields, {
      name: "  Farmamad  ",
      email: "  pagos@farmamad.com  ",
      phone: " 0414-1234567 ",
      count: " 12 ",
      enabled: false,
    });

    expect(result.errors).toEqual({});
    expect(result.details).toEqual({
      name: "Farmamad",
      email: "pagos@farmamad.com",
      phone: "0414-1234567",
      count: 12,
      enabled: false,
    });
  });

  it("rejects a missing or blank required field", () => {
    const result = validateDetails(PAYPAL_FIELDS, {});

    expect(result.errors).toEqual({ "details.email": "email is required" });
    expect(result.details).toEqual({});
  });

  it("rejects an unknown field with the documented message", () => {
    const result = validateDetails(PAYPAL_FIELDS, {
      email: "pagos@farmamad.com",
      cvv: "123",
    });

    expect(result.errors).toEqual({ "details.cvv": "Unknown field" });
  });

  it("omits optional null and blank values", () => {
    const fields = [
      field({ key: "network", type: "text" }),
      field({ key: "note", type: "text" }),
    ];

    const result = validateDetails(fields, { network: null, note: "   " });

    expect(result.errors).toEqual({});
    expect(result.details).toEqual({});
  });

  it("keeps optional false and zero values", () => {
    const fields = [
      field({ key: "enabled", type: "boolean" }),
      field({ key: "count", type: "integer" }),
    ];

    expect(
      validateDetails(fields, { enabled: false, count: 0 }).details,
    ).toEqual({ enabled: false, count: 0 });
  });

  it.each([
    ["text", 5, "5", "value must be a string"],
    ["text", {}, {}, "value must be a string"],
    ["email", "not-an-email", "not-an-email", "value must be a valid email"],
    ["phone", "abc", "abc", "value must be a valid phone"],
    ["phone", "123", "123", "value must be a valid phone"],
    ["integer", 1.5, 1.5, "value must be an integer"],
    ["integer", "1.5", "1.5", "value must be an integer"],
    ["boolean", "true", "true", "value must be a boolean"],
    ["boolean", 1, 1, "value must be a boolean"],
    ["text", ["a"], ["a"], "value must be a string"],
  ])("rejects a %s value %p", (type, value, _raw, expected) => {
    const result = validateDetails([field({ type, required: true })], {
      value,
    });

    expect(result.errors).toEqual({ "details.value": expected });
  });

  it("applies the custom max_length and the type defaults", () => {
    const fields = [
      field({ key: "short", type: "text", max_length: 3 }),
      field({ key: "long", type: "text" }),
    ];

    expect(
      validateDetails(fields, { short: "abcd", long: "x".repeat(256) }).errors,
    ).toEqual({
      "details.short": "short must have at most 3 characters",
      "details.long": "long must have at most 255 characters",
    });
  });

  it("caps email at 254 and phone at 20 characters", () => {
    const fields = [
      field({
        key: "email",
        type: "email",
        required: true,
        max_length: 255,
      }),
      field({ key: "phone", type: "phone", max_length: 255 }),
    ];

    const email = `${"a".repeat(250)}@b.co`;
    const result = validateDetails(fields, {
      email,
      phone: "1".repeat(21),
    });

    expect(result.errors).toEqual({
      "details.email": "email must have at most 254 characters",
      "details.phone": "phone must be a valid phone",
    });
  });

  it("rejects a non-object details value", () => {
    expect(validateDetails(PAYPAL_FIELDS, [])).toEqual({
      details: {},
      errors: { details: "details must be an object" },
    });
    expect(validateDetails(PAYPAL_FIELDS, "text").errors).toEqual({
      details: "details must be an object",
    });
  });

  it("collects several errors at once", () => {
    const result = validateDetails(
      [
        field({ key: "email", type: "email", required: true }),
        field({ key: "phone", type: "phone", required: true }),
      ],
      { email: "bad", unknown: 1 },
    );

    expect(result.errors).toEqual({
      "details.email": "email must be a valid email",
      "details.phone": "phone is required",
      "details.unknown": "Unknown field",
    });
  });

  it("treats a missing fields definition as no defined fields", () => {
    expect(validateDetails(undefined, { any: "value" }).errors).toEqual({
      "details.any": "Unknown field",
    });
  });
});
