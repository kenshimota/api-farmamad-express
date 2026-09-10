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
});
