const swaggerSpec = require("./swagger");

describe("swagger spec", () => {
  it("documents the API endpoints", () => {
    expect(swaggerSpec.openapi).toBeDefined();
    expect(Object.keys(swaggerSpec.paths)).toEqual(
      expect.arrayContaining([
        "/hello-world",
        "/health",
        "/auth/login",
        "/auth/me",
        "/auth/setup-status",
        "/auth/register-admin",
        "/users",
        "/roles",
        "/customers",
        "/customers/{id}",
        "/warehouses",
        "/warehouses/{id}",
        "/categories",
        "/categories/{id}",
        "/images",
        "/images/{id}",
        "/suppliers",
        "/suppliers/{id}",
        "/stocks",
        "/stocks/{id}",
        "/stocks/product/{product_id}",
        "/stocks/available",
        "/stocks/available/{product_id}",
        "/purchases",
        "/purchases/{id}",
        "/purchases/{id}/items",
        "/purchases/{purchase_id}/items/{item_id}",
        "/purchases/{id}/confirm",
        "/purchases/{id}/cancel",
        "/currencies",
        "/currencies/{id}",
        "/currencies/{id}/history",
        "/shelves",
        "/shelves/{id}",
        "/shelves/{shelf_id}/sections",
        "/shelves/{shelf_id}/sections/{section_id}",
      ]),
    );
  });

  it("documents the bearer authentication scheme", () => {
    expect(swaggerSpec.components.securitySchemes.bearerAuth).toMatchObject({
      type: "http",
      scheme: "bearer",
      bearerFormat: "JWT",
    });
  });

  it("documents the Role schema and the role field in User", () => {
    expect(swaggerSpec.components.schemas.Role).toMatchObject({
      type: "object",
      properties: {
        id: { type: "integer" },
        name: { type: "string" },
      },
    });
    expect(swaggerSpec.components.schemas.User.properties.role).toBeDefined();
  });

  it("documents the six valid role names in the catalog and POST /users", () => {
    const roles = [
      "admin",
      "customer",
      "seller",
      "dispatcher",
      "manager_warehouse",
      "support",
    ];
    const createUser =
      swaggerSpec.paths["/users"].post.requestBody.content["application/json"]
        .schema.properties.role;

    expect(swaggerSpec.components.schemas.Role.properties.name.enum).toEqual(
      roles,
    );
    expect(createUser.enum).toEqual(roles);
  });

  it("documents the Customer schema without audit fields", () => {
    expect(swaggerSpec.components.schemas.Customer).toMatchObject({
      type: "object",
      properties: {
        id: { type: "integer" },
        fullName: { type: "string" },
        latitude: { type: "number", example: -17.7833 },
        longitude: { type: "number", example: -63.1821 },
        direction: { type: "string" },
        email: { type: "string", format: "email" },
      },
    });
    expect(
      swaggerSpec.components.schemas.Customer.properties,
    ).not.toHaveProperty("createdAt");
  });

  it("documents the Warehouse schema without audit fields", () => {
    expect(swaggerSpec.components.schemas.Warehouse).toMatchObject({
      type: "object",
      properties: {
        id: { type: "integer" },
        name: { type: "string" },
        observations: { type: "string", nullable: true },
        address: { type: "string" },
      },
    });
    expect(
      swaggerSpec.components.schemas.Warehouse.properties,
    ).not.toHaveProperty("createdAt");
    expect(swaggerSpec.tags).toEqual(
      expect.arrayContaining([expect.objectContaining({ name: "Warehouses" })]),
    );
  });

  it("documents the Category schema without audit fields", () => {
    expect(swaggerSpec.components.schemas.Category).toMatchObject({
      type: "object",
      properties: {
        id: { type: "integer" },
        name: { type: "string" },
      },
    });
    expect(
      swaggerSpec.components.schemas.Category.properties,
    ).not.toHaveProperty("createdAt");
    expect(swaggerSpec.tags).toEqual(
      expect.arrayContaining([expect.objectContaining({ name: "Categories" })]),
    );
  });

  it("documents the Image schema without audit fields", () => {
    expect(swaggerSpec.components.schemas.Image).toMatchObject({
      type: "object",
      properties: {
        id: { type: "integer" },
        url: { type: "string", format: "uri" },
        pathname: { type: "string", nullable: true },
        reference: { type: "string" },
        thumbnail: { type: "string", format: "uri" },
      },
    });
    expect(swaggerSpec.components.schemas.Image.properties).not.toHaveProperty(
      "createdAt",
    );
    expect(swaggerSpec.tags).toEqual(
      expect.arrayContaining([expect.objectContaining({ name: "Images" })]),
    );
  });

  it("documents the Supplier schema without audit fields", () => {
    expect(swaggerSpec.components.schemas.Supplier).toMatchObject({
      type: "object",
      properties: {
        id: { type: "integer" },
        name: { type: "string" },
        identification: { type: "string" },
        email: { type: "string", format: "email" },
        phone: { type: "string" },
        observations: { type: "string", nullable: true },
        address: { type: "string" },
        city_id: { type: "integer" },
        state_id: { type: "integer" },
      },
    });
    expect(
      swaggerSpec.components.schemas.Supplier.properties,
    ).not.toHaveProperty("createdAt");
    expect(
      swaggerSpec.components.schemas.Supplier.properties.city,
    ).toBeDefined();
    expect(
      swaggerSpec.components.schemas.Supplier.properties.state,
    ).toBeDefined();
    expect(swaggerSpec.tags).toEqual(
      expect.arrayContaining([expect.objectContaining({ name: "Suppliers" })]),
    );
  });

  it("documents the Stock and AvailableStock schemas without audit fields", () => {
    expect(swaggerSpec.components.schemas.Stock).toMatchObject({
      type: "object",
      properties: {
        id: { type: "integer" },
        product_id: { type: "integer" },
        item_state_id: { type: "integer" },
        quantity: { type: "integer" },
      },
    });
    expect(swaggerSpec.components.schemas.Stock.properties).not.toHaveProperty(
      "createdAt",
    );
    expect(swaggerSpec.components.schemas.AvailableStock).toMatchObject({
      type: "object",
      properties: {
        product_id: { type: "integer" },
        item_state_id: { type: "integer" },
        quantity: { type: "integer" },
        cost: { type: "number", nullable: true },
      },
    });
    expect(swaggerSpec.tags).toEqual(
      expect.arrayContaining([expect.objectContaining({ name: "Stocks" })]),
    );
  });
  it("documents the Purchase schemas without audit fields", () => {
    expect(swaggerSpec.components.schemas.Purchase).toMatchObject({
      type: "object",
      properties: {
        id: { type: "integer" },
        number: { type: "integer" },
        supplier_id: { type: "integer" },
        status: { type: "string" },
        subtotal: { type: "number" },
        tax_amount: { type: "number" },
        total: { type: "number" },
      },
    });
    const purchaseProperties =
      swaggerSpec.components.schemas.Purchase.properties;
    const itemProperties =
      swaggerSpec.components.schemas.PurchaseItem.properties;

    expect(purchaseProperties).not.toHaveProperty("tax_rate");
    expect(itemProperties).toMatchObject({
      tax_amount: { type: "number" },
      total: { type: "number" },
    });
    expect(purchaseProperties).not.toHaveProperty("createdAt");
    expect(itemProperties).not.toHaveProperty("createdAt");
    expect(
      swaggerSpec.components.schemas.PurchaseItemUpdate.required,
    ).toBeUndefined();
    expect(swaggerSpec.tags).toEqual(
      expect.arrayContaining([expect.objectContaining({ name: "Purchases" })]),
    );
  });

  it("documents the Currency and CurrencyRateHistory schemas", () => {
    expect(swaggerSpec.components.schemas.Currency).toMatchObject({
      type: "object",
      properties: {
        id: { type: "integer" },
        code: { type: "string" },
        name: { type: "string" },
        symbol: { type: "string" },
        rate: { type: "number" },
        is_base: { type: "boolean" },
        is_active: { type: "boolean" },
      },
    });
    expect(
      swaggerSpec.components.schemas.Currency.properties,
    ).not.toHaveProperty("createdAt");
    expect(swaggerSpec.components.schemas.CurrencyRateHistory).toMatchObject({
      type: "object",
      properties: {
        id: { type: "integer" },
        currency_id: { type: "integer" },
        previous_rate: { type: "number", nullable: true },
        new_rate: { type: "number" },
        changed_by: { type: "object", nullable: true },
        changed_at: { type: "string", format: "date-time" },
        reason: { type: "string", nullable: true },
      },
    });
    expect(swaggerSpec.tags).toEqual(
      expect.arrayContaining([expect.objectContaining({ name: "Currencies" })]),
    );
  });

  it("documents the generic 500 and 404 schemas and responses", () => {
    expect(swaggerSpec.components.schemas.InternalServerError).toMatchObject({
      type: "object",
      properties: {
        message: { type: "string", example: "Internal server error" },
      },
    });
    expect(swaggerSpec.components.schemas.NotFound).toMatchObject({
      type: "object",
      properties: { message: { type: "string", example: "Not found" } },
    });
    expect(swaggerSpec.components.responses.InternalServerError).toBeDefined();
    expect(swaggerSpec.components.responses.NotFound).toBeDefined();
  });

  it("references the generic 500 and 404 responses in every endpoint", () => {
    for (const path of Object.values(swaggerSpec.paths)) {
      for (const operation of Object.values(path)) {
        expect(operation.responses["500"]).toBeDefined();
        expect(operation.responses["404"]).toBeDefined();
      }
    }
  });
});
