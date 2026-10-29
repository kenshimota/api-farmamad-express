const {
  createPurchaseItemSchema,
  createPurchaseSchema,
  updatePurchaseItemSchema,
  updatePurchaseSchema,
} = require("./validators");

/**
 * Validates a body against a schema with the production options.
 * @param {import("yup").Schema} schema - Schema to apply.
 * @param {object} body - Request body.
 * @returns {Promise<object>} The validated body.
 */
function validate(schema, body) {
  return schema.validate(body, { abortEarly: false, stripUnknown: true });
}

const VALID_ITEM = {
  product_id: 15,
  item_state_id: 1,
  quantity: 1,
  unit_cost: 10,
  tax_amount: 1.6,
};

describe("createPurchaseSchema", () => {
  it("defaults the items to an empty array, trims notes and strips tax_rate", async () => {
    await expect(
      validate(createPurchaseSchema, {
        supplier_id: "2",
        notes: "  Reposición  ",
        number: 99,
        status: "confirmed",
        tax_rate: 16,
      }),
    ).resolves.toEqual({ supplier_id: 2, notes: "Reposición", items: [] });
  });

  it("accepts a full body and strips unknown item fields", async () => {
    const result = await validate(createPurchaseSchema, {
      supplier_id: 2,
      tax_rate: "8.25",
      notes: null,
      items: [
        {
          ...VALID_ITEM,
          unit_cost: "20.00",
          subtotal: 1,
        },
      ],
    });

    expect(result).toEqual({
      supplier_id: 2,
      notes: null,
      items: [
        {
          product_id: 15,
          item_state_id: 1,
          quantity: 1,
          unit_cost: 20,
          tax_amount: 1.6,
        },
      ],
    });
  });

  it.each([
    [{ supplier_id: 0 }, "supplier_id"],
    [{ supplier_id: 2, notes: 5 }, "notes"],
    [{ supplier_id: 2, notes: "x".repeat(1001) }, "notes"],
    [{ supplier_id: 2, items: {} }, "items"],
  ])("rejects invalid purchase %p", async (body) => {
    await expect(validate(createPurchaseSchema, body)).rejects.toThrow();
  });

  it("requires tax_amount on every line with the nested error path", async () => {
    const { tax_amount, ...withoutTax } = VALID_ITEM;

    await expect(
      validate(createPurchaseSchema, {
        supplier_id: 2,
        items: [withoutTax],
      }),
    ).rejects.toMatchObject({
      inner: [
        expect.objectContaining({
          path: "items[0].tax_amount",
          message: "tax_amount is required",
        }),
      ],
    });
  });

  it("accepts blank notes as null", async () => {
    const result = await validate(createPurchaseSchema, {
      supplier_id: 2,
      notes: "   ",
    });

    expect(result.notes).toBeNull();
  });
});

describe("purchase item schemas", () => {
  it.each([
    [{ product_id: 0 }, "product_id"],
    [{ item_state_id: 0 }, "item_state_id"],
    [{ quantity: 0 }, "quantity"],
    [{ quantity: 1.5 }, "quantity"],
    [{ quantity: 1000001 }, "quantity"],
    [{ unit_cost: -1 }, "unit_cost"],
    [{ unit_cost: 1.234 }, "unit_cost"],
    [{ unit_cost: null }, "unit_cost"],
    [{ unit_cost: "" }, "unit_cost"],
    [{ tax_amount: -1 }, "tax_amount"],
    [{ tax_amount: 1.234 }, "tax_amount"],
    [{ tax_amount: 10000000000 }, "tax_amount"],
    [{ tax_amount: null }, "tax_amount"],
    [{ tax_amount: "" }, "tax_amount"],
    [{ tax_amount: "abc" }, "tax_amount"],
  ])("rejects invalid line %p", async (overrides) => {
    const body = { ...VALID_ITEM, ...overrides };

    await expect(validate(createPurchaseItemSchema, body)).rejects.toThrow();
  });

  it("accepts the maximum tax amount with ten integer digits", async () => {
    await expect(
      validate(createPurchaseItemSchema, {
        ...VALID_ITEM,
        tax_amount: 9999999999.99,
      }),
    ).resolves.toMatchObject({ tax_amount: 9999999999.99 });
  });

  it("keeps every field optional on the update schemas", async () => {
    await expect(validate(updatePurchaseSchema, {})).resolves.toEqual({});
    await expect(validate(updatePurchaseItemSchema, {})).resolves.toEqual({});
  });

  it("validates tax_amount on update when it is sent", async () => {
    await expect(
      validate(updatePurchaseItemSchema, { tax_amount: 4.5 }),
    ).resolves.toEqual({ tax_amount: 4.5 });
    await expect(
      validate(updatePurchaseItemSchema, { tax_amount: -1 }),
    ).rejects.toThrow("tax_amount must be >= 0");
  });
});
