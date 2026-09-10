const path = require("path");
const swaggerJsdoc = require("swagger-jsdoc");

const swaggerSpec = swaggerJsdoc({
  definition: {
    openapi: "3.0.3",
    info: {
      title: "Bread King API",
      version: "1.0.0",
      description: "REST API for Bread King, documented with Swagger.",
    },
    servers: [{ url: "/" }],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },
      schemas: {
        User: {
          type: "object",
          properties: {
            id: { type: "integer", example: 1 },
            username: { type: "string", example: "juan" },
            email: {
              type: "string",
              format: "email",
              example: "juan@example.com",
            },
            name: { type: "string", nullable: true, example: "Juan" },
          },
        },
        ErrorMessage: {
          type: "object",
          properties: { message: { type: "string" } },
        },
        ValidationErrors: {
          type: "object",
          properties: {
            errors: {
              type: "object",
              additionalProperties: { type: "string" },
              example: { email: "Invalid email" },
            },
          },
        },
      },
    },
  },
  apis: [path.join(__dirname, "..", "**", "*.js")],
});

module.exports = swaggerSpec;
