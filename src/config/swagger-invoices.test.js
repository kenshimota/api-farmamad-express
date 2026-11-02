const swaggerSpec = require("./swagger");

describe("swagger invoice spec", () => {
  it("documents the read-only invoice endpoints", () => {
    expect(swaggerSpec.paths["/invoices"].get).toBeDefined();
    expect(swaggerSpec.paths["/invoices/{id}"].get).toBeDefined();
    expect(swaggerSpec.paths["/invoices"].post).toBeUndefined();
    expect(swaggerSpec.paths["/invoices/{id}"].put).toBeUndefined();
    expect(swaggerSpec.paths["/invoices/{id}"].delete).toBeUndefined();
  });

  it("documents the invoice and detail schemas", () => {
    expect(swaggerSpec.components.schemas.Invoice).toMatchObject({
      type: "object",
      properties: {
        number: { type: "integer" },
        order_id: { type: "integer", nullable: true },
        customer_id: { type: "integer" },
        payment_term_id: { type: "integer" },
        balance_due: { type: "number" },
        payment_status: {
          type: "string",
          enum: ["pending", "partial", "paid"],
        },
      },
    });
    expect(
      swaggerSpec.components.schemas.Invoice.properties,
    ).not.toHaveProperty("createdAt");
    expect(
      swaggerSpec.components.schemas.InvoiceDetail.properties.items.type,
    ).toBe("array");
    expect(
      swaggerSpec.components.schemas.InvoiceDetail.properties.invoiced_by,
    ).toBeDefined();
  });

  it("registers the Invoices tag", () => {
    expect(swaggerSpec.tags).toEqual(
      expect.arrayContaining([expect.objectContaining({ name: "Invoices" })]),
    );
  });

  it("documents the filter and error responses", () => {
    const list = swaggerSpec.paths["/invoices"].get;
    const detail = swaggerSpec.paths["/invoices/{id}"].get;

    expect(list.parameters.map((parameter) => parameter.name)).toEqual([
      "order_id",
      "customer_id",
      "number",
      "payment_status",
    ]);
    expect(list.responses["422"]).toBeDefined();
    expect(detail.responses["404"]).toBeDefined();
    expect(detail.responses["422"]).toBeDefined();
    expect(detail.parameters[0].name).toBe("id");
  });
});

describe("swagger invoice payments spec", () => {
  it("documents the apply and history endpoints", () => {
    const payments = swaggerSpec.paths["/invoices/{id}/payments"];

    expect(payments.post).toBeDefined();
    expect(payments.post.summary).toMatch(/applies a wallet payment/i);
    expect(payments.post.requestBody.required).toBe(true);
    expect(payments.post.responses["201"]).toBeDefined();
    expect(payments.post.responses["409"]).toBeDefined();
    expect(payments.post.responses["422"]).toBeDefined();
    expect(payments.get).toBeDefined();
    expect(payments.get.responses["200"]).toBeDefined();
    expect(payments.get.responses["404"]).toBeDefined();
    expect(payments.put).toBeUndefined();
    expect(payments.delete).toBeUndefined();
  });

  it("registers the payment allocation schemas", () => {
    expect(swaggerSpec.components.schemas.PaymentAllocation).toMatchObject({
      type: "object",
      properties: {
        id: { type: "integer" },
        payment_id: { type: "integer" },
        amount: { type: "number" },
        applied_amount: { type: "number" },
        exchange_rate: { type: "number" },
        allocated_at: { type: "string", format: "date-time" },
      },
    });
    expect(swaggerSpec.components.schemas.InvoicePaymentHistory).toBeDefined();
  });
});
