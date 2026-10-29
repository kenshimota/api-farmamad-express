const swaggerSpec = require("./swagger");

describe("swagger taxes spec", () => {
  it("documents the Tax schema without audit fields", () => {
    expect(swaggerSpec.components.schemas.Tax).toMatchObject({
      type: "object",
      properties: {
        id: { type: "integer" },
        code: { type: "string" },
        name: { type: "string" },
        rate: { type: "number" },
        description: { type: "string", nullable: true },
        is_active: { type: "boolean" },
      },
    });
    expect(swaggerSpec.components.schemas.Tax.properties).not.toHaveProperty(
      "createdAt",
    );
    expect(swaggerSpec.components.schemas.Tax.properties).not.toHaveProperty(
      "updatedAt",
    );
  });

  it("documents the taxes endpoints and tag", () => {
    expect(swaggerSpec.paths["/taxes"].get).toBeDefined();
    expect(swaggerSpec.paths["/taxes"].post).toBeDefined();
    expect(swaggerSpec.paths["/taxes/{id}"].get).toBeDefined();
    expect(swaggerSpec.paths["/taxes/{id}"].put).toBeDefined();
    expect(swaggerSpec.paths["/taxes/{id}"].delete).toBeDefined();
    expect(swaggerSpec.tags).toEqual(
      expect.arrayContaining([expect.objectContaining({ name: "Taxes" })]),
    );
  });
});
