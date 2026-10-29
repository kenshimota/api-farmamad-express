const authSchemas = {
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
      isBlocked: {
        type: "boolean",
        description:
          "Whether the account is blocked and cannot start a session",
        example: false,
      },
    },
  },
  Role: {
    type: "object",
    properties: {
      id: { type: "integer", example: 1 },
      name: {
        type: "string",
        enum: [
          "admin",
          "customer",
          "seller",
          "dispatcher",
          "manager_warehouse",
          "support",
        ],
        example: "admin",
      },
    },
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
    description: "One-time recovery code; only the bcrypt hash is persisted",
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
};

module.exports = authSchemas;
