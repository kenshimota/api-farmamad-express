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
