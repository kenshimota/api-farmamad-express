const {
  FIELDS_MESSAGE,
  MAX_FIELDS,
  createMethodPaymentTypeSchema,
  isValidFieldsDefinition,
} = require("./validators");

const VALID_FIELD = Object.freeze({
  key: "email",
  label: "Correo de PayPal",
  type: "email",
  required: true,
});

const VALID = Object.freeze({
  code: "PAYPAL",
  name: "PayPal",
  currency_id: 3,
  fields: [VALID_FIELD],
});

/**
 * Validates a create body and returns only the `fields` error.
 * @param {unknown} fields - Candidate fields definition.
 * @returns {Promise<Record<string, string>|null>} Error map or null.
 */
async function fieldsError(fields) {
  try {
    await createMethodPaymentTypeSchema.validate(
      { ...VALID, fields },
      { abortEarly: false, stripUnknown: true },
    );

    return null;
  } catch (error) {
    const issue = (error.inner ?? [error]).find(
      (candidate) => candidate.path === "fields",
    );

    return issue ? { [issue.path]: issue.message } : {};
  }
}

describe("fields definition (RF-05)", () => {
  it("accepts the documented field types and max_length on text-like types", async () => {
    const fields = [
      {
        key: "texto",
        label: "Texto",
        type: "text",
        required: true,
        max_length: 255,
      },
      { key: "email", label: "Email", type: "email", required: true },
      {
        key: "phone",
        label: "Teléfono",
        type: "phone",
        required: false,
        max_length: 1,
      },
      { key: "count", label: "Cantidad", type: "integer", required: true },
      { key: "flag", label: "Bandera", type: "boolean", required: false },
    ];

    await expect(fieldsError(fields)).resolves.toBeNull();
    expect(isValidFieldsDefinition(fields)).toBe(true);
  });

  it("accepts up to 20 uniquely keyed fields", async () => {
    const fields = Array.from({ length: MAX_FIELDS }, (_, index) => ({
      key: `field_${index}`,
      label: `Campo ${index}`,
      type: "text",
      required: false,
    }));

    await expect(fieldsError(fields)).resolves.toBeNull();
  });

  it("rejects more than 20 fields", async () => {
    const fields = Array.from({ length: MAX_FIELDS + 1 }, (_, index) => ({
      key: `field_${index}`,
      label: `Campo ${index}`,
      type: "text",
      required: false,
    }));

    await expect(fieldsError(fields)).resolves.toEqual({
      fields: FIELDS_MESSAGE,
    });
  });

  it("rejects duplicated keys", async () => {
    const fields = [VALID_FIELD, { ...VALID_FIELD, label: "Otro" }];

    await expect(fieldsError(fields)).resolves.toEqual({
      fields: FIELDS_MESSAGE,
    });
  });

  it.each([
    ["additional properties", { ...VALID_FIELD, extra: true }],
    ["an unknown type", { ...VALID_FIELD, type: "select" }],
    ["a non boolean required", { ...VALID_FIELD, required: "true" }],
    ["an invalid key", { ...VALID_FIELD, key: "Email" }],
    ["a missing label", { ...VALID_FIELD, label: undefined }],
    ["a missing key", { ...VALID_FIELD, key: undefined }],
    ["an unknown property", { key: "x", label: "X", type: "text", other: 1 }],
  ])("rejects a definition with %s", async (label, field) => {
    await expect(fieldsError([field])).resolves.toEqual({
      fields: FIELDS_MESSAGE,
    });
  });

  it.each([
    ["integer", { ...VALID_FIELD, type: "integer", max_length: 10 }],
    ["boolean", { ...VALID_FIELD, type: "boolean", max_length: 10 }],
  ])("rejects max_length on %s fields", async (label, field) => {
    await expect(fieldsError([field])).resolves.toEqual({
      fields: FIELDS_MESSAGE,
    });
  });

  it.each([[0], [256], [1.5], ["10"]])(
    "rejects the invalid max_length %p",
    async (maxLength) => {
      await expect(
        fieldsError([{ ...VALID_FIELD, max_length: maxLength }]),
      ).resolves.toEqual({ fields: FIELDS_MESSAGE });
    },
  );

  it.each([[null], ["not-an-array"], [{}], [42]])(
    "rejects the non-array fields %p",
    async (fields) => {
      await expect(fieldsError(fields)).resolves.toEqual({
        fields: FIELDS_MESSAGE,
      });
    },
  );

  it("accepts an empty array and rejects a missing key inside a definition", () => {
    expect(isValidFieldsDefinition([])).toBe(true);
    expect(isValidFieldsDefinition([{ label: "X", type: "text" }])).toBe(false);
    expect(isValidFieldsDefinition(undefined)).toBe(false);
  });
});
