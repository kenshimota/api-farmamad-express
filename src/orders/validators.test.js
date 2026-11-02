const {
  createOrderSchema,
  DELIVERY_ADDRESS_MESSAGE,
  ITEMS_ARRAY_MESSAGE,
  ITEMS_MAX_MESSAGE,
  ITEMS_MIN_MESSAGE,
  NOTES_MESSAGE,
  QUANTITY_MAX_MESSAGE,
  QUANTITY_MIN_MESSAGE,
} = require("./validators");

/**
 * Validates a body with the create schema.
 * @param {object} body - Raw request body.
 * @returns {Promise<object>} The validated body.
 */
function validate(body) {
  return createOrderSchema.validate(body, {
    abortEarly: false,
    stripUnknown: true,
  });
}

/**
 * Captures the first validation error message.
 * @param {object} body - Raw request body.
 * @returns {Promise<Record<string, string>>} Field errors by path.
 */
async function errorsOf(body) {
  try {
    await validate(body);
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
  it("accepts a valid body and trims text fields", async () => {
    const body = await validate({ ...VALID_BODY, status: "delivered" });

    expect(body).toEqual({
      items: [{ product_id: 15, item_state_id: 1, quantity: 2 }],
      delivery_address: "Av. Monseñor Rivero 123",
      notes: "Entregar por la tarde",
    });
    expect(body).not.toHaveProperty("status");
  });

  it("accepts omitted optional delivery_address and notes", async () => {
    const body = await validate({
      items: [{ product_id: 15, item_state_id: 1, quantity: 1 }],
    });

    expect(body.delivery_address).toBeUndefined();
    expect(body.notes).toBeUndefined();
  });

  it("rejects an empty items array and more than 50 lines", async () => {
    expect(await errorsOf({ items: [] })).toEqual({
      items: ITEMS_MIN_MESSAGE,
    });

    const tooMany = Array.from({ length: 51 }, (_, index) => ({
      product_id: index + 1,
      item_state_id: 1,
      quantity: 1,
    }));

    expect(await errorsOf({ items: tooMany })).toEqual({
      items: ITEMS_MAX_MESSAGE,
    });
  });

  it("rejects a non-array items value", async () => {
    expect(await errorsOf({ items: "nope" })).toEqual({
      items: ITEMS_ARRAY_MESSAGE,
    });
  });

  it("rejects quantities outside 1..999 and non-integers", async () => {
    expect(
      await errorsOf({
        items: [{ product_id: 15, item_state_id: 1, quantity: 0 }],
      }),
    ).toEqual({ "items.0.quantity": QUANTITY_MIN_MESSAGE });

    expect(
      await errorsOf({
        items: [{ product_id: 15, item_state_id: 1, quantity: 1000 }],
      }),
    ).toEqual({ "items.0.quantity": QUANTITY_MAX_MESSAGE });
  });

  it("rejects invalid product and item state ids", async () => {
    const errors = await errorsOf({
      items: [{ product_id: 0, item_state_id: "x", quantity: 1 }],
    });

    expect(errors["items.0.product_id"]).toBeDefined();
    expect(errors["items.0.item_state_id"]).toBeDefined();
  });

  it("rejects a blank or too long delivery_address", async () => {
    expect(await errorsOf({ ...VALID_BODY, delivery_address: "   " })).toEqual({
      delivery_address: DELIVERY_ADDRESS_MESSAGE,
    });

    expect(
      await errorsOf({ ...VALID_BODY, delivery_address: "x".repeat(501) }),
    ).toEqual({ delivery_address: DELIVERY_ADDRESS_MESSAGE });
  });

  it("rejects notes longer than 1000 characters", async () => {
    expect(await errorsOf({ ...VALID_BODY, notes: "x".repeat(1001) })).toEqual({
      notes: NOTES_MESSAGE,
    });
  });
});
