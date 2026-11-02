const {
  CODE_MESSAGE,
  createOrderStatusSchema,
  NEXT_STATUS_CODE_MESSAGE,
  SORT_ORDER_MESSAGE,
  updateOrderStatusSchema,
} = require("./validators");

/**
 * Captures field errors from a schema.
 * @param {import("yup").Schema} schema - Schema under test.
 * @param {object} body - Raw body.
 * @returns {Promise<Record<string, string>>} Errors by path.
 */
async function errorsOf(schema, body) {
  try {
    await schema.validate(body, { abortEarly: false, stripUnknown: true });
  } catch (error) {
    return Object.fromEntries(
      (error.inner ?? [error]).map((issue) => [
        String(issue.path),
        issue.message,
      ]),
    );
  }

  return {};
}

describe("order status validators", () => {
  it("normalizes a valid create body", async () => {
    const body = await createOrderStatusSchema.validate(
      {
        code: "on_hold",
        name: "  En espera  ",
        description: "  Esperando  ",
        sort_order: 25,
        next_status_code: "generate",
        is_system: true,
      },
      { stripUnknown: true },
    );

    expect(body).toEqual({
      code: "on_hold",
      name: "En espera",
      description: "Esperando",
      sort_order: 25,
      next_status_code: "generate",
    });
  });

  it("rejects invalid codes, sort order and next code", async () => {
    const errors = await errorsOf(createOrderStatusSchema, {
      code: "A",
      name: "",
      sort_order: -1,
      next_status_code: "BAD",
    });

    expect(errors.code).toBe(CODE_MESSAGE);
    expect(errors.sort_order).toBe(SORT_ORDER_MESSAGE);
    expect(errors.next_status_code).toBe(NEXT_STATUS_CODE_MESSAGE);
  });

  it("accepts partial updates and a null next status", async () => {
    await expect(
      updateOrderStatusSchema.validate(
        { name: "Nuevo", next_status_code: null },
        { stripUnknown: true },
      ),
    ).resolves.toEqual({ name: "Nuevo", next_status_code: null });
  });
});
