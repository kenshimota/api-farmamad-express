const {
  CODE_MESSAGE,
  DAYS_MESSAGE,
  DAYS_RANGE_MESSAGE,
  IS_ACTIVE_MESSAGE,
  REQUIRED_PAYMENT_TERM_FIELDS,
  UPDATE_PAYMENT_TERM_FIELDS,
  createPaymentTermSchema,
  parseBooleanFlag,
  parsePaymentTermId,
  updatePaymentTermSchema,
} = require("./validators");

/**
 * Validates a body with the same options used by the HTTP middleware.
 * @param {import("yup").Schema} schema - Schema under test.
 * @param {object} body - Raw request body.
 * @returns {Promise<object>} The validated body.
 */
function validate(schema, body) {
  return schema.validate(body, { abortEarly: false, stripUnknown: true });
}

describe("payment term validators", () => {
  it("exposes the required and editable fields", () => {
    expect(REQUIRED_PAYMENT_TERM_FIELDS).toEqual(["code", "name", "days"]);
    expect(UPDATE_PAYMENT_TERM_FIELDS).toEqual([
      "name",
      "description",
      "days",
      "is_active",
    ]);
  });

  it("normalizes the code to lowercase and trims the text fields", async () => {
    await expect(
      validate(createPaymentTermSchema, {
        code: "  credit_30  ",
        name: "  Crédito 30 días  ",
        description: "  Pago a 30 días  ",
        days: "30",
        unknown: true,
      }),
    ).resolves.toEqual({
      code: "credit_30",
      name: "Crédito 30 días",
      description: "Pago a 30 días",
      days: 30,
      is_active: true,
    });
  });

  it("accepts cash (days = 0), null description and an inactive flag", async () => {
    await expect(
      validate(createPaymentTermSchema, {
        code: "cash",
        name: "Contado",
        description: null,
        days: 0,
        is_active: false,
      }),
    ).resolves.toEqual({
      code: "cash",
      name: "Contado",
      description: null,
      days: 0,
      is_active: false,
    });
  });

  it("turns a blank description into null", async () => {
    const result = await validate(createPaymentTermSchema, {
      code: "credit_10",
      name: "Crédito 10 días",
      description: "   ",
      days: 10,
    });

    expect(result.description).toBeNull();
  });

  it.each([
    [{ code: "Credit term" }, { code: CODE_MESSAGE }],
    [{ code: "c" }, { code: CODE_MESSAGE }],
    [{ code: "1credit" }, { code: CODE_MESSAGE }],
    [{ code: "credit-10" }, { code: CODE_MESSAGE }],
    [{ name: "   " }, { name: expect.any(String) }],
    [{ name: "x".repeat(101) }, { name: expect.any(String) }],
    [{ days: "abc" }, { days: DAYS_MESSAGE }],
    [{ days: -1 }, { days: DAYS_RANGE_MESSAGE }],
    [{ days: 3651 }, { days: DAYS_RANGE_MESSAGE }],
    [{ days: 1.5 }, { days: DAYS_MESSAGE }],
    [{ description: "x".repeat(256) }, { description: expect.any(String) }],
    [{ is_active: "true" }, { is_active: IS_ACTIVE_MESSAGE }],
  ])("rejects the invalid body %p", async (overrides) => {
    await expect(
      validate(createPaymentTermSchema, {
        code: "credit_15",
        name: "Crédito 15 días",
        days: 15,
        ...overrides,
      }),
    ).rejects.toThrow();
  });

  it("keeps update fields optional and ignores code", async () => {
    await expect(
      validate(updatePaymentTermSchema, {
        code: "ignored",
        name: "Crédito 45 días",
      }),
    ).resolves.toEqual({ name: "Crédito 45 días" });
  });

  it("parses positive integer ids and rejects everything else", () => {
    expect(parsePaymentTermId("1")).toBe(1);
    expect(parsePaymentTermId(4)).toBe(4);
    expect(parsePaymentTermId(" 12 ")).toBe(12);

    for (const value of ["0", "-1", "1.5", "abc", "", null, undefined, {}]) {
      expect(parsePaymentTermId(value)).toBeNull();
    }
  });

  it("parses strict boolean query flags", () => {
    expect(parseBooleanFlag("true")).toBe(true);
    expect(parseBooleanFlag("false")).toBe(false);
    expect(parseBooleanFlag(true)).toBe(true);
    expect(parseBooleanFlag("maybe")).toBeUndefined();
    expect(parseBooleanFlag(null)).toBeUndefined();
  });
});
