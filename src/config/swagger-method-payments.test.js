const swaggerSpec = require("./swagger");

describe("swagger method payments spec", () => {
  it("documents the MethodPayment schema without audit fields", () => {
    expect(swaggerSpec.components.schemas.MethodPayment).toMatchObject({
      type: "object",
      properties: {
        id: { type: "integer" },
        method_payment_type_id: { type: "integer" },
        label: { type: "string" },
        details: { type: "object" },
        is_active: { type: "boolean" },
        currency_id: { type: "integer" },
        currency: { $ref: "#/components/schemas/CurrencySummary" },
        method_payment_type: { type: "object" },
      },
    });
    expect(
      swaggerSpec.components.schemas.MethodPayment.properties,
    ).not.toHaveProperty("createdAt");
    expect(
      swaggerSpec.components.schemas.MethodPayment.properties,
    ).not.toHaveProperty("updatedAt");
  });

  it("documents the endpoints and tag", () => {
    expect(swaggerSpec.paths["/method-payments"].get).toBeDefined();
    expect(swaggerSpec.paths["/method-payments"].post).toBeDefined();
    expect(swaggerSpec.paths["/method-payments/{id}"].get).toBeDefined();
    expect(swaggerSpec.paths["/method-payments/{id}"].put).toBeDefined();
    expect(swaggerSpec.paths["/method-payments/{id}"].delete).toBeDefined();
    expect(swaggerSpec.tags).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "Method payments" }),
      ]),
    );
  });
});
