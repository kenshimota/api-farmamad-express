const swaggerSpec = require("./swagger");

describe("swagger order spec", () => {
  it("documents POST /orders and its error responses", () => {
    const operation = swaggerSpec.paths["/orders"].post;

    expect(operation).toBeDefined();
    expect(
      operation.requestBody.content["application/json"].schema.required,
    ).toEqual(["items"]);
    for (const status of [
      "201",
      "400",
      "401",
      "403",
      "404",
      "409",
      "422",
      "503",
      "500",
    ]) {
      expect(operation.responses[status]).toBeDefined();
    }
  });

  it("documents the order schemas without internal lot fields", () => {
    const schema = swaggerSpec.components.schemas.OrderDetail;
    const item = swaggerSpec.components.schemas.OrderItem;

    expect(schema).toMatchObject({
      type: "object",
      properties: {
        number: { type: "integer" },
        status: { type: "string" },
        subtotal: { type: "number" },
        total: { type: "number" },
      },
    });
    expect(schema.properties).not.toHaveProperty("createdAt");
    expect(item.properties).not.toHaveProperty("lot_id");
    expect(item.properties).not.toHaveProperty("allocations");
    expect(item.properties).not.toHaveProperty("cost");
  });

  it("registers the Orders tag", () => {
    expect(swaggerSpec.tags).toEqual(
      expect.arrayContaining([expect.objectContaining({ name: "Orders" })]),
    );
  });
});
