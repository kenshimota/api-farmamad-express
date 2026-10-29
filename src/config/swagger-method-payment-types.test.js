const swaggerSpec = require("./swagger");

describe("swagger method payment types spec", () => {
  it("documents the MethodPaymentType schema without audit fields", () => {
    expect(swaggerSpec.components.schemas.MethodPaymentType).toMatchObject({
      type: "object",
      properties: {
        id: { type: "integer" },
        code: { type: "string" },
        name: { type: "string" },
        currency_id: { type: "integer" },
        currency: { $ref: "#/components/schemas/CurrencySummary" },
        fields: { type: "array" },
        description: { type: "string", nullable: true },
        is_active: { type: "boolean" },
      },
    });
    expect(
      swaggerSpec.components.schemas.MethodPaymentType.properties,
    ).not.toHaveProperty("createdAt");
    expect(
      swaggerSpec.components.schemas.MethodPaymentType.properties,
    ).not.toHaveProperty("updatedAt");
  });

  it("documents the endpoints and tag", () => {
    expect(swaggerSpec.paths["/method-payment-types"].get).toBeDefined();
    expect(swaggerSpec.paths["/method-payment-types"].post).toBeDefined();
    expect(swaggerSpec.paths["/method-payment-types/{id}"].get).toBeDefined();
    expect(swaggerSpec.paths["/method-payment-types/{id}"].put).toBeDefined();
    expect(
      swaggerSpec.paths["/method-payment-types/{id}"].delete,
    ).toBeDefined();
    expect(swaggerSpec.tags).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "Method payment types" }),
      ]),
    );
  });
});
