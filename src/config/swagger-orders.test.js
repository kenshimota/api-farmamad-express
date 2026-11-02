const swaggerSpec = require("./swagger");

describe("swagger order spec", () => {
  it("documents POST /orders and its error responses", () => {
    const operation = swaggerSpec.paths["/orders"].post;

    expect(operation).toBeDefined();
    expect(
      operation.requestBody.content["application/json"].schema.required,
    ).toBeUndefined();
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

  it("documents the lifecycle, items and status endpoints", () => {
    for (const path of [
      "/orders",
      "/orders/{id}",
      "/orders/{id}/items",
      "/orders/{id}/items/{item_id}",
      "/orders/{id}/status",
      "/orders/{id}/payment-term",
      "/orders/{id}/invoice",
      "/order-statuses",
      "/order-statuses/{id}",
    ]) {
      expect(swaggerSpec.paths[path]).toBeDefined();
    }

    expect(swaggerSpec.paths["/orders/{id}/items"].post).toBeDefined();
    expect(swaggerSpec.paths["/orders/{id}/status"].put).toBeDefined();
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

  it("registers the Orders and Order statuses tags", () => {
    expect(swaggerSpec.tags).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "Orders" }),
        expect.objectContaining({ name: "Order statuses" }),
      ]),
    );
  });

  it("documents the OrderStatus schema with is_terminal and is_system", () => {
    const schema = swaggerSpec.components.schemas.OrderStatus;

    expect(schema.properties).toMatchObject({
      code: expect.objectContaining({ type: "string" }),
      next_status_code: expect.objectContaining({ nullable: true }),
      is_terminal: expect.objectContaining({ type: "boolean" }),
      is_system: expect.objectContaining({ type: "boolean" }),
    });
  });
});
