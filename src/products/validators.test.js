const {
  MAX_NAME_LENGTH,
  MAX_REFERENCE_LENGTH,
  parseProductId,
  productSchema,
  REQUIRED_PRODUCT_FIELDS,
} = require("./validators");
const { formatValidationErrors } = require("../auth/validators");

const VALID = {
  name: "Ibuprofeno 400 mg",
  description: "Analgésico y antiinflamatorio",
  reference: "IBU-400",
  category_id: 1,
  image_id: 2,
};

/**
 * Validates a body with the product schema and the same options used by the
 * request middleware.
 * @param {object} body - Request body.
 * @returns {Promise<object>} The validated data.
 */
function validate(body) {
  return productSchema.validate(body, {
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

describe("productSchema", () => {
  it("accepts a valid product and trims the text fields", async () => {
    await expect(
      validate({
        ...VALID,
        name: "  Ibuprofeno 400 mg  ",
        description: "  Analgésico y antiinflamatorio  ",
        reference: "  IBU-400  ",
      }),
    ).resolves.toEqual(VALID);
  });

  it("accepts values with exactly the maximum length", async () => {
    const name = "a".repeat(MAX_NAME_LENGTH);
    const reference = "a".repeat(MAX_REFERENCE_LENGTH);

    await expect(validate({ ...VALID, name, reference })).resolves.toEqual({
      ...VALID,
      name,
      reference,
    });
  });

  it("drops unknown and audit fields", async () => {
    const data = await validate({
      ...VALID,
      id: 99,
      createdAt: "2026-09-01",
      updatedAt: "2026-09-01",
      admin: true,
    });

    expect(data).toEqual(VALID);
  });

  it.each([
    ["name is blank", { name: "   " }],
    ["name is not text", { name: 123 }],
    ["name exceeds 150 characters", { name: "a".repeat(151) }],
  ])("rejects when %s", async (_case, overrides) => {
    await expect(errorsFor({ ...VALID, ...overrides })).resolves.toEqual({
      name: "Nombre inválido",
    });
  });

  it.each([
    ["description is blank", { description: "   " }],
    ["description is not text", { description: 123 }],
  ])("rejects when %s", async (_case, overrides) => {
    await expect(errorsFor({ ...VALID, ...overrides })).resolves.toEqual({
      description: "Descripción inválida",
    });
  });

  it.each([
    ["reference is blank", { reference: "   " }],
    ["reference is not text", { reference: 123 }],
    ["reference exceeds 100 characters", { reference: "a".repeat(101) }],
  ])("rejects when %s", async (_case, overrides) => {
    await expect(errorsFor({ ...VALID, ...overrides })).resolves.toEqual({
      reference: "Referencia inválida",
    });
  });

  it.each([0, -1, 1.5, "abc", null])(
    "rejects an invalid category_id (%p)",
    async (value) => {
      await expect(
        errorsFor({ ...VALID, category_id: value }),
      ).resolves.toEqual({ category_id: "Invalid category id" });
    },
  );

  it.each([0, -1, 1.5, "abc", null])(
    "rejects an invalid image_id (%p)",
    async (value) => {
      await expect(errorsFor({ ...VALID, image_id: value })).resolves.toEqual({
        image_id: "Invalid image id",
      });
    },
  );
});

describe("REQUIRED_PRODUCT_FIELDS", () => {
  it("lists the five required fields in contract order", () => {
    expect(REQUIRED_PRODUCT_FIELDS).toEqual([
      "name",
      "description",
      "reference",
      "category_id",
      "image_id",
    ]);
  });
});

describe("parseProductId", () => {
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
    expect(parseProductId(value)).toBe(expected);
  });
});
