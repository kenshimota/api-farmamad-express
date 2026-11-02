const {
  addItemSchema,
  createOrderSchema,
  DELIVERY_ADDRESS_MESSAGE,
  ITEMS_ARRAY_MESSAGE,
  ITEMS_MAX_MESSAGE,
  NOTES_MESSAGE,
  QUANTITY_MAX_MESSAGE,
  QUANTITY_MIN_MESSAGE,
  statusUpdateSchema,
  updateItemSchema,
} = require("./validators");

/**
 * Validates a body with a schema.
 * @param {import("yup").Schema} schema - Schema under test.
 * @param {object} body - Raw request body.
 * @returns {Promise<object>} The validated body.
 */
function validate(schema, body) {
  return schema.validate(body, { abortEarly: false, stripUnknown: true });
}

/**
 * Captures field errors by path.
 * @param {import("yup").Schema} schema - Schema under test.
 * @param {object} body - Raw request body.
 * @returns {Promise<Record<string, string>>} Errors by path.
 */
async function errorsOf(schema, body) {
  try {
    await validate(schema, body);
  } catch (error) {
    return Object.fromEntries(
      (error.inner ?? [error]).map((issue) => [
        String(issue.path).replace(/\[(\d+)\]/g, ".$1"),
        issue.message,
      ]),
    );
  }

  return {};
}

const VALID_BODY = {
  items: [{ product_id: 15, item_state_id: 1, quantity: 2 }],
  delivery_address: "  Av. Monseñor Rivero 123  ",
  notes: "  Entregar por la tarde  ",
};

describe("createOrderSchema", () => {
  it("accepts a valid body, trims text and strips server fields", async () => {
    const body = await validate(createOrderSchema, {
      ...VALID_BODY,
      status: "delivered",
      customer_id: 8,
    });

    expect(body).toEqual({
      customer_id: 8,
      items: [{ product_id: 15, item_state_id: 1, quantity: 2 }],
      delivery_address: "Av. Monseñor Rivero 123",
      notes: "Entregar por la tarde",
    });
    expect(body).not.toHaveProperty("status");
  });

  it("accepts a draft without items or customer_id", async () => {
    const body = await validate(createOrderSchema, {
      notes: "Pedido vacío",
    });

    expect(body.items).toBeUndefined();
    expect(body.customer_id).toBeUndefined();
    expect(body.delivery_address).toBeUndefined();
  });

  it("accepts an empty items array", async () => {
    const body = await validate(createOrderSchema, { items: [] });

    expect(body.items).toEqual([]);
  });

  it("rejects more than 50 lines and a non-array items value", async () => {
    const tooMany = Array.from({ length: 51 }, (_, index) => ({
      product_id: index + 1,
      item_state_id: 1,
      quantity: 1,
    }));

    expect(await errorsOf(createOrderSchema, { items: tooMany })).toEqual({
      items: ITEMS_MAX_MESSAGE,
    });
    expect(await errorsOf(createOrderSchema, { items: "nope" })).toEqual({
      items: ITEMS_ARRAY_MESSAGE,
    });
  });

  it("rejects quantities outside 1..999", async () => {
    expect(
      await errorsOf(createOrderSchema, {
        items: [{ product_id: 15, item_state_id: 1, quantity: 0 }],
      }),
    ).toEqual({ "items.0.quantity": QUANTITY_MIN_MESSAGE });

    expect(
      await errorsOf(createOrderSchema, {
        items: [{ product_id: 15, item_state_id: 1, quantity: 1000 }],
      }),
    ).toEqual({ "items.0.quantity": QUANTITY_MAX_MESSAGE });
  });

  it("rejects invalid product and item state ids", async () => {
    const errors = await errorsOf(addItemSchema, {
      product_id: 0,
      item_state_id: "x",
      quantity: 1,
    });

    expect(errors.product_id).toBeDefined();
    expect(errors.item_state_id).toBeDefined();
  });

  it("rejects a blank or too long delivery_address and long notes", async () => {
    expect(
      await errorsOf(createOrderSchema, { delivery_address: "   " }),
    ).toEqual({ delivery_address: DELIVERY_ADDRESS_MESSAGE });

    expect(
      await errorsOf(createOrderSchema, { delivery_address: "x".repeat(501) }),
    ).toEqual({ delivery_address: DELIVERY_ADDRESS_MESSAGE });

    expect(
      await errorsOf(createOrderSchema, { notes: "x".repeat(1001) }),
    ).toEqual({ notes: NOTES_MESSAGE });
  });
});

describe("lifecycle body schemas", () => {
  it("requires only quantity when updating a line", async () => {
    await expect(
      validate(updateItemSchema, { quantity: 3, product_id: 15 }),
    ).resolves.toEqual({ quantity: 3 });

    expect(await errorsOf(updateItemSchema, {})).toEqual({
      quantity: expect.any(String),
    });
  });

  it("requires a status value", async () => {
    await expect(
      validate(statusUpdateSchema, { status: "  request  " }),
    ).resolves.toEqual({ status: "request" });

    expect(await errorsOf(statusUpdateSchema, { status: "  " })).toEqual({
      status: "Invalid status",
    });
  });
});
