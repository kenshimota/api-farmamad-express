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
            role: {
              type: "string",
              description: "Name of the role stored in the roles table",
              example: "admin",
            },
          },
        },
        Role: {
          type: "object",
          properties: {
            id: { type: "integer", example: 1 },
            name: { type: "string", example: "admin" },
          },
        },
        ErrorMessage: {
          type: "object",
          properties: { message: { type: "string" } },
        },
        TokenResponse: {
          type: "object",
          properties: {
            token: {
              type: "string",
              example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
            },
            user: { $ref: "#/components/schemas/User" },
          },
        },
        PasswordResetCode: {
          type: "object",
          description:
            "One-time recovery code; only the bcrypt hash is persisted",
          properties: {
            id: { type: "integer", example: 1 },
            userId: { type: "integer", example: 1 },
            codeHash: {
              type: "string",
              description: "bcrypt hash of the 8-digit code, never the code",
            },
            expiresAt: { type: "string", format: "date-time" },
            consumedAt: { type: "string", format: "date-time", nullable: true },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
          },
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
