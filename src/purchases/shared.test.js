const {
  ForeignKeyConstraintError,
  UniqueConstraintError,
} = require("sequelize");
const { handlePurchaseError } = require("./shared");

/**
 * Builds a minimal Express response double.
 * @returns {object} Response double.
 */
function response() {
  return {
    statusCode: 200,
    body: undefined,
    status: jest.fn(function status(code) {
      this.statusCode = code;
      return this;
    }),
    json: jest.fn(function json(body) {
      this.body = body;
      return this;
    }),
  };
}

describe("handlePurchaseError", () => {
  it("serializes service errors with their status and body", () => {
    const res = response();

    handlePurchaseError(
      { status: 409, body: { message: "Purchase is not editable" } },
      res,
    );

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.body).toEqual({ message: "Purchase is not editable" });
  });

  it("answers 409 for a duplicated line", () => {
    const res = response();

    handlePurchaseError(new UniqueConstraintError({ message: "dup" }), res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.body).toEqual({ message: "Item already exists" });
  });

  it.each([
    ["supplier_id", { supplier_id: "Invalid supplier id" }],
    ["product_id", { product_id: "Invalid product id" }],
    ["item_state_id", { item_state_id: "Invalid item state id" }],
  ])("answers 422 for the %s foreign key", (field, body) => {
    const res = response();
    const error = new ForeignKeyConstraintError({
      message: "foreign key",
      fields: { [field]: 1 },
    });

    handlePurchaseError(error, res);

    expect(res.status).toHaveBeenCalledWith(422);
    expect(res.body).toEqual({ errors: body });
  });

  it("reads the field from the driver message when necessary", () => {
    const res = response();
    const error = new ForeignKeyConstraintError({
      message:
        'violates foreign key constraint "purchase_items_product_id_fkey"',
    });

    handlePurchaseError(error, res);

    expect(res.body).toEqual({ errors: { product_id: "Invalid product id" } });
  });

  it("rethrows unclassified errors", () => {
    const unknown = new Error("database exploded");
    const foreign = new ForeignKeyConstraintError({ message: "other" });

    expect(() => handlePurchaseError(unknown, response())).toThrow(unknown);
    expect(() => handlePurchaseError(foreign, response())).toThrow(foreign);
  });
});
