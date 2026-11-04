const swaggerSpec = require("./swagger");

describe("swagger picking spec", () => {
  it("documents GET /orders/{id}/picking with its responses", () => {
    const operation = swaggerSpec.paths["/orders/{id}/picking"].get;

    expect(operation).toBeDefined();
    expect(operation.parameters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ in: "path", name: "id" }),
        expect.objectContaining({ in: "query", name: "allocation_status" }),
      ]),
    );
    for (const status of ["200", "401", "403", "404", "422", "500"]) {
      expect(operation.responses[status]).toBeDefined();
    }
    expect(
      operation.responses["200"].content["application/json"].schema.$ref,
    ).toBe("#/components/schemas/OrderPicking");
  });

  it("documents the picking response schemas", () => {
    const schema = swaggerSpec.components.schemas.OrderPicking;

    expect(schema).toMatchObject({
      type: "object",
      properties: {
        order: { $ref: "#/components/schemas/PickingOrderHeader" },
        summary: { $ref: "#/components/schemas/PickingSummary" },
        items: { type: "array" },
      },
    });
    expect(
      swaggerSpec.components.schemas.PickingAllocation.properties.quantity
        .description,
    ).toContain("Units to pack");
  });
});
