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
