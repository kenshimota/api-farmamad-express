const swaggerSpec = require("./swagger");

describe("swagger payment term spec", () => {
  it("documents the payment term CRUD endpoints", () => {
    expect(swaggerSpec.paths["/payment-terms"].post).toBeDefined();
    expect(swaggerSpec.paths["/payment-terms"].get).toBeDefined();
    expect(swaggerSpec.paths["/payment-terms/{id}"].get).toBeDefined();
    expect(swaggerSpec.paths["/payment-terms/{id}"].put).toBeDefined();
    expect(swaggerSpec.paths["/payment-terms/{id}"].delete).toBeDefined();
    expect(swaggerSpec.paths["/orders/{id}/payment-term"].put).toBeDefined();
  });

  it("documents the PaymentTerm and PaymentTermSummary schemas", () => {
    expect(swaggerSpec.components.schemas.PaymentTerm).toMatchObject({
      type: "object",
      properties: {
        code: {
          type: "string",
          pattern: "^[a-z][a-z0-9_]{1,29}$",
        },
        days: { type: "integer", minimum: 0, maximum: 3650 },
        is_active: { type: "boolean" },
      },
    });
    expect(
      swaggerSpec.components.schemas.PaymentTermSummary.properties,
    ).toMatchObject({
      id: { type: "integer" },
      code: { type: "string" },
      name: { type: "string" },
      days: { type: "integer" },
    });
  });

  it("registers the Payment terms tag", () => {
    expect(swaggerSpec.tags).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "Payment terms" }),
      ]),
    );
  });

  it("exposes payment_term on customers, orders and invoices", () => {
    expect(swaggerSpec.components.schemas.Customer.properties).toHaveProperty(
      "payment_term_id",
    );
    expect(swaggerSpec.components.schemas.Customer.properties).toHaveProperty(
      "payment_term",
    );
    expect(
      swaggerSpec.components.schemas.OrderDetail.properties,
    ).toHaveProperty("payment_term_id");
    expect(swaggerSpec.components.schemas.Invoice.properties).toHaveProperty(
      "payment_term",
    );
  });
});
