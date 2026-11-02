const {
  ForeignKeyConstraintError,
  UniqueConstraintError,
} = require("sequelize");
const { handleInvoiceError } = require("./shared");

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

describe("handleInvoiceError", () => {
  it("serializes controlled HTTP errors", () => {
    const res = response();

    handleInvoiceError(
      { status: 404, body: { message: "Invoice not found" } },
      res,
    );

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.body).toEqual({ message: "Invoice not found" });
  });

  it("maps a duplicated order invoice to 409", () => {
    const res = response();
    const error = new UniqueConstraintError({
      message:
        'duplicate key value violates unique constraint "invoices_order_id_unique"',
      fields: { order_id: 10 },
    });

    handleInvoiceError(error, res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.body).toEqual({ message: "Order already has an invoice" });
  });

  it("maps another unique violation to 409", () => {
    const res = response();
    const error = new UniqueConstraintError({
      message: "duplicate key",
      fields: { number: 1 },
    });

    handleInvoiceError(error, res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.body).toEqual({ message: "Invoice already exists" });
  });

  it.each([
    ["customer_id", "Invalid customer id"],
    ["invoiced_by_user_id", "Invalid user id"],
    ["currency_id", "Invalid currency id"],
    ["product_id", "Invalid product id"],
    ["item_state_id", "Invalid item state id"],
    ["invoice_id", "Invalid invoice id"],
  ])("maps the %s foreign key to 422", (field, message) => {
    const res = response();
    const error = new ForeignKeyConstraintError({
      message: "foreign key",
      fields: { [field]: 1 },
    });

    handleInvoiceError(error, res);

    expect(res.status).toHaveBeenCalledWith(422);
    expect(res.body).toEqual({ errors: { [field]: message } });
  });

  it("rethrows unknown errors and unmapped foreign keys", () => {
    const unknown = new Error("boom");
    const foreign = new ForeignKeyConstraintError({ message: "other" });

    expect(() => handleInvoiceError(unknown, response())).toThrow(unknown);
    expect(() => handleInvoiceError(foreign, response())).toThrow(foreign);
  });
});
