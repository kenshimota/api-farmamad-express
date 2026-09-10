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
});
