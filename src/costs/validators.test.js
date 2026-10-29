const {
  COST_DECIMALS_MESSAGE,
  COST_INTEGER_DIGITS_MESSAGE,
  COST_MESSAGE,
  COST_NEGATIVE_MESSAGE,
  ITEM_STATE_FILTER_MESSAGE,
  ITEM_STATE_ID_MESSAGE,
  PRODUCT_FILTER_MESSAGE,
  PRODUCT_ID_MESSAGE,
  REQUIRED_COST_FIELDS,
  createCostSchema,
  parseCostId,
  parseItemStateId,
  parseProductId,
  updateCostSchema,
} = require("./validators");
const { formatValidationErrors } = require("../auth/validators");

const VALID = { product_id: 15, item_state_id: 2, cost: 12.5 };

/**
 * Validates a body with the create schema and the same options used by the
 * request middleware.
 * @param {object} body - Request body.
 * @returns {Promise<object>} The validated data.
 */
function validate(body) {
  return createCostSchema.validate(body, {
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
  return updateCostSchema.validate(body, {
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

describe("createCostSchema", () => {
  it("accepts a valid cost and keeps the numeric values", async () => {
    await expect(validate(VALID)).resolves.toEqual(VALID);
  });

  it("accepts zero and the maximum documented amount", async () => {
    await expect(validate({ ...VALID, cost: 0 })).resolves.toEqual({
      ...VALID,
      cost: 0,
    });
    await expect(validate({ ...VALID, cost: 999999999.99 })).resolves.toEqual({
      ...VALID,
      cost: 999999999.99,
    });
  });

  it("accepts numeric strings and casts them to numbers", async () => {
    await expect(
      validate({ product_id: "15", item_state_id: "2", cost: "12.50" }),
    ).resolves.toEqual(VALID);
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
    ["zero", 0],
    ["negative", -1],
    ["decimal", 1.5],
    ["not numeric", "abc"],
    ["null", null],
  ])("rejects product_id when it is %s", async (_case, value) => {
    await expect(errorsFor({ ...VALID, product_id: value })).resolves.toEqual({
      product_id: PRODUCT_ID_MESSAGE,
    });
  });

  it.each([
    ["zero", 0],
    ["negative", -1],
    ["decimal", 1.5],
    ["not numeric", "abc"],
    ["null", null],
  ])("rejects item_state_id when it is %s", async (_case, value) => {
    await expect(
      errorsFor({ ...VALID, item_state_id: value }),
    ).resolves.toEqual({ item_state_id: ITEM_STATE_ID_MESSAGE });
  });

  it("rejects a negative cost with the documented message", async () => {
    await expect(errorsFor({ ...VALID, cost: -0.01 })).resolves.toEqual({
      cost: COST_NEGATIVE_MESSAGE,
    });
  });

  it("rejects a cost with more than two decimals", async () => {
    await expect(errorsFor({ ...VALID, cost: 12.345 })).resolves.toEqual({
      cost: COST_DECIMALS_MESSAGE,
    });
    await expect(errorsFor({ ...VALID, cost: "12.345" })).resolves.toEqual({
      cost: COST_DECIMALS_MESSAGE,
    });
  });

  it("rejects a cost with more than nine integer digits", async () => {
    await expect(errorsFor({ ...VALID, cost: 1000000000 })).resolves.toEqual({
      cost: COST_INTEGER_DIGITS_MESSAGE,
    });
  });

  it.each([
    ["a boolean", true],
    ["an object", {}],
    ["an array", [12.5]],
    ["text", "doce"],
    ["null", null],
  ])("rejects cost when it is %s", async (_case, value) => {
    await expect(errorsFor({ ...VALID, cost: value })).resolves.toEqual({
      cost: COST_MESSAGE,
    });
  });
});

describe("updateCostSchema", () => {
  it("keeps only the provided fields without adding defaults", async () => {
    await expect(validateUpdate({ cost: 20 })).resolves.toEqual({ cost: 20 });
    await expect(
      validateUpdate({ product_id: 3, item_state_id: 4 }),
    ).resolves.toEqual({ product_id: 3, item_state_id: 4 });
  });

  it("rejects the same invalid values as the create schema", async () => {
    const errors = await validateUpdate({ cost: -1 }).catch((error) =>
      formatValidationErrors(error),
    );

    expect(errors).toEqual({ cost: COST_NEGATIVE_MESSAGE });
  });
});

describe("REQUIRED_COST_FIELDS", () => {
  it("lists the three fields required to create a cost", () => {
    expect(REQUIRED_COST_FIELDS).toEqual([
      "product_id",
      "item_state_id",
      "cost",
    ]);
  });
});

describe("identifier and filter parsers", () => {
  const valid = [
    [1, 1],
    ["2", 2],
    ["  3  ", 3],
  ];
  const invalid = [
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
  ];

  it.each([...valid, ...invalid])(
    "parses cost id %p as %p",
    (value, expected) => {
      expect(parseCostId(value)).toBe(expected);
    },
  );

  it.each([...valid, ...invalid])(
    "parses product filter %p as %p",
    (value, expected) => {
      expect(parseProductId(value)).toBe(expected);
    },
  );

  it.each([...valid, ...invalid])(
    "parses item state filter %p as %p",
    (value, expected) => {
      expect(parseItemStateId(value)).toBe(expected);
    },
  );

  it("exposes the documented filter messages", () => {
    expect(PRODUCT_FILTER_MESSAGE).toBe("Invalid product id");
    expect(ITEM_STATE_FILTER_MESSAGE).toBe("Invalid item state id");
    expect(PRODUCT_ID_MESSAGE).toBe("Invalid product");
    expect(ITEM_STATE_ID_MESSAGE).toBe("Invalid item state");
  });
});
