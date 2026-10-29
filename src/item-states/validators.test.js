const {
  createItemStateSchema,
  updateItemStateSchema,
  DESCRIPTION_MESSAGE,
  IS_SELLABLE_MESSAGE,
  LABEL_MESSAGE,
  MAX_DESCRIPTION_LENGTH,
  MAX_LABEL_LENGTH,
  MAX_NAME_LENGTH,
  MIN_LABEL_LENGTH,
  MIN_NAME_LENGTH,
  NAME_MESSAGE,
  parseItemStateId,
  parseSellable,
  REQUIRED_ITEM_STATE_FIELDS,
} = require("./validators");
const { formatValidationErrors } = require("../auth/validators");

const VALID = { name: "sellable", label: "Vendible" };

/**
 * Validates a body with the create schema and the same options used by the
 * request middleware.
 * @param {object} body - Request body.
 * @returns {Promise<object>} The validated data.
 */
function validate(body) {
  return createItemStateSchema.validate(body, {
    abortEarly: false,
    stripUnknown: true,
  });
}

/**
 * Validates a body with the update schema.
 * @param {object} body - Request body.
 * @returns {Promise<object>} The validated data.
 */
function validateUpdate(body) {
  return updateItemStateSchema.validate(body, {
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

describe("createItemStateSchema", () => {
  it("accepts a valid item state and applies the documented defaults", async () => {
    await expect(validate(VALID)).resolves.toEqual({
      ...VALID,
      description: null,
      is_sellable: false,
    });
  });

  it("trims the name, label and description", async () => {
    await expect(
      validate({
        name: "  sellable  ",
        label: "  Vendible  ",
        description: "  Producto apto  ",
        is_sellable: true,
      }),
    ).resolves.toEqual({
      name: "sellable",
      label: "Vendible",
      description: "Producto apto",
      is_sellable: true,
    });
  });

  it("accepts the minimum and maximum documented lengths", async () => {
    await expect(
      validate({
        name: "a".repeat(MIN_NAME_LENGTH),
        label: "b".repeat(MIN_LABEL_LENGTH),
        description: "d".repeat(MAX_DESCRIPTION_LENGTH),
      }),
    ).resolves.toEqual({
      name: "a".repeat(MIN_NAME_LENGTH),
      label: "b".repeat(MIN_LABEL_LENGTH),
      description: "d".repeat(MAX_DESCRIPTION_LENGTH),
      is_sellable: false,
    });
    await expect(
      validate({
        name: "a".repeat(MAX_NAME_LENGTH),
        label: "b".repeat(MAX_LABEL_LENGTH),
      }),
    ).resolves.toEqual({
      name: "a".repeat(MAX_NAME_LENGTH),
      label: "b".repeat(MAX_LABEL_LENGTH),
      description: null,
      is_sellable: false,
    });
  });

  it("accepts null and blank descriptions as null", async () => {
    await expect(validate({ ...VALID, description: null })).resolves.toEqual({
      ...VALID,
      description: null,
      is_sellable: false,
    });
    await expect(validate({ ...VALID, description: "   " })).resolves.toEqual({
      ...VALID,
      description: null,
      is_sellable: false,
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

    expect(data).toEqual({
      ...VALID,
      description: null,
      is_sellable: false,
    });
  });

  it.each([
    ["name is empty", { ...VALID, name: "   " }],
    ["name is too short", { ...VALID, name: "a" }],
    ["name has uppercase letters", { ...VALID, name: "Sellable" }],
    ["name has a hyphen", { ...VALID, name: "not-sellable" }],
    ["name has a space", { ...VALID, name: "not sellable" }],
    ["name has an accent", { ...VALID, name: "vendible" + "á" }],
    ["name is not text", { ...VALID, name: { a: 1 } }],
    ["name is a number", { ...VALID, name: 123 }],
    ["name exceeds 50 characters", { ...VALID, name: "a".repeat(51) }],
  ])("rejects when %s", async (_case, body) => {
    await expect(errorsFor(body)).resolves.toEqual({
      name: NAME_MESSAGE,
    });
  });

  it.each([
    ["label is empty", { ...VALID, label: "   " }],
    ["label is too short", { ...VALID, label: "V" }],
    ["label is not text", { ...VALID, label: { a: 1 } }],
    ["label is a number", { ...VALID, label: 123 }],
    ["label exceeds 100 characters", { ...VALID, label: "b".repeat(101) }],
  ])("rejects when %s", async (_case, body) => {
    await expect(errorsFor(body)).resolves.toEqual({
      label: LABEL_MESSAGE,
    });
  });

  it("rejects a description longer than 255 characters", async () => {
    await expect(
      errorsFor({ ...VALID, description: "d".repeat(256) }),
    ).resolves.toEqual({
      description: DESCRIPTION_MESSAGE,
    });
  });

  it.each([
    ["a string", "true"],
    ["a number", 1],
    ["zero", 0],
    ["an object", {}],
  ])("rejects is_sellable when it is %s", async (_case, isSellable) => {
    await expect(
      errorsFor({ ...VALID, is_sellable: isSellable }),
    ).resolves.toEqual({
      is_sellable: IS_SELLABLE_MESSAGE,
    });
  });
});

describe("updateItemStateSchema", () => {
  it("keeps the provided fields without adding defaults", async () => {
    await expect(validateUpdate({ label: "  Vendible  " })).resolves.toEqual({
      label: "Vendible",
    });
    await expect(
      validateUpdate({ is_sellable: false, description: null }),
    ).resolves.toEqual({ is_sellable: false, description: null });
  });

  it("rejects the same invalid values as the create schema", async () => {
    await expect(
      updateItemStateSchema
        .validate({ name: "Sellable" }, { abortEarly: false })
        .catch((error) => formatValidationErrors(error)),
    ).resolves.toEqual({ name: NAME_MESSAGE });
  });
});

describe("REQUIRED_ITEM_STATE_FIELDS", () => {
  it("lists name and label as the required fields", () => {
    expect(REQUIRED_ITEM_STATE_FIELDS).toEqual(["name", "label"]);
  });
});

describe("parseItemStateId", () => {
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
    expect(parseItemStateId(value)).toBe(expected);
  });
});

describe("parseSellable", () => {
  it.each([
    ["true", true],
    ["false", false],
    ["  true  ", true],
    ["  false  ", false],
    [true, true],
    [false, false],
    ["yes", undefined],
    ["1", undefined],
    ["", undefined],
    [1, undefined],
    [null, undefined],
    [undefined, undefined],
  ])("parses %p as %p", (value, expected) => {
    expect(parseSellable(value)).toBe(expected);
  });
});
