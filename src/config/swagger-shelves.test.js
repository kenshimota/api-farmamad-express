const swaggerSpec = require("./swagger");

describe("swagger shelves spec", () => {
  it("documents the Shelf and ShelfSection schemas", () => {
    expect(swaggerSpec.components.schemas.Shelf).toMatchObject({
      type: "object",
      properties: {
        id: { type: "integer" },
        warehouse_id: { type: "integer" },
        code: { type: "string" },
        name: { type: "string", nullable: true },
        description: { type: "string", nullable: true },
        sections: { type: "array" },
      },
    });
    expect(swaggerSpec.components.schemas.Shelf.properties).not.toHaveProperty(
      "createdAt",
    );
    expect(swaggerSpec.components.schemas.ShelfSection).toMatchObject({
      type: "object",
      properties: {
        id: { type: "integer" },
        shelf_id: { type: "integer" },
        code: { type: "string" },
        name: { type: "string", nullable: true },
        description: { type: "string", nullable: true },
      },
    });
    expect(
      swaggerSpec.components.schemas.ShelfSection.properties,
    ).not.toHaveProperty("createdAt");
    expect(swaggerSpec.tags).toEqual(
      expect.arrayContaining([expect.objectContaining({ name: "Shelves" })]),
    );
  });
});
