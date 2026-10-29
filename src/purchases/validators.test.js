const {
  createPurchaseItemSchema,
  createPurchaseSchema,
  resolveDefaultTaxRate,
  updatePurchaseItemSchema,
  updatePurchaseSchema,
} = require("./validators");

const ORIGINAL_TAX_RATE = process.env.PURCHASE_TAX_RATE;

/**
 * Validates a body against a schema with the production options.
 * @param {import("yup").Schema} schema - Schema to apply.
 * @param {object} body - Request body.
 * @returns {Promise<object>} The validated body.
 */
function validate(schema, body) {
  return schema.validate(body, { abortEarly: false, stripUnknown: true });
}

afterEach(() => {
  if (ORIGINAL_TAX_RATE === undefined) {
    delete process.env.PURCHASE_TAX_RATE;
  } else {
    process.env.PURCHASE_TAX_RATE = ORIGINAL_TAX_RATE;
  }
});

describe("createPurchaseSchema", () => {
  it("defaults the items to an empty array, trims notes and strips unknown fields", async () => {
    await expect(
      validate(createPurchaseSchema, {
        supplier_id: "2",
        notes: "  Reposición  ",
        number: 99,
        status: "confirmed",
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
          product_id: 15,
          item_state_id: 1,
          quantity: 40,
          unit_cost: "20.00",
          subtotal: 1,
        },
      ],
    });

    expect(result).toEqual({
      supplier_id: 2,
      tax_rate: 8.25,
      notes: null,
      items: [
        {
          product_id: 15,
          item_state_id: 1,
          quantity: 40,
          unit_cost: 20,
        },
      ],
    });
  });

  it.each([
    [{ supplier_id: 0 }, "supplier_id"],
    [{ supplier_id: 2, tax_rate: null }, "tax_rate"],
    [{ supplier_id: 2, tax_rate: "" }, "tax_rate"],
    [{ supplier_id: 2, tax_rate: 100.01 }, "tax_rate"],
    [{ supplier_id: 2, notes: 5 }, "notes"],
    [{ supplier_id: 2, notes: "x".repeat(1001) }, "notes"],
    [{ supplier_id: 2, items: {} }, "items"],
  ])("rejects invalid purchase %p", async (body) => {
    await expect(validate(createPurchaseSchema, body)).rejects.toThrow();
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
  ])("rejects invalid line %p", async (overrides) => {
    const body = {
      product_id: 15,
      item_state_id: 1,
      quantity: 1,
      unit_cost: 10,
      ...overrides,
    };

    await expect(validate(createPurchaseItemSchema, body)).rejects.toThrow();
  });

  it("keeps every field optional on the update schemas", async () => {
    await expect(validate(updatePurchaseSchema, {})).resolves.toEqual({});
    await expect(validate(updatePurchaseItemSchema, {})).resolves.toEqual({});
  });
});

describe("resolveDefaultTaxRate", () => {
  it.each([
    [undefined, 16],
    ["", 16],
    ["8.25", 8.25],
    ["0", 0],
    ["100", 100],
    ["abc", 16],
    ["-1", 16],
    ["101", 16],
    ["8.255", 16],
  ])("resolves %p as %p", (raw, expected) => {
    if (raw === undefined) {
      delete process.env.PURCHASE_TAX_RATE;
    } else {
      process.env.PURCHASE_TAX_RATE = raw;
    }

    expect(resolveDefaultTaxRate()).toBe(expected);
  });
});
