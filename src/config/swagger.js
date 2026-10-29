const path = require("path");
const swaggerJsdoc = require("swagger-jsdoc");

const swaggerSpec = swaggerJsdoc({
  definition: {
    openapi: "3.0.3",
    info: {
      title: "Super King API",
      version: "1.0.0",
      description:
        "REST API for Super King, documented with Swagger. Every PUT endpoint answers 202 Accepted when the update succeeds.",
    },
    servers: [{ url: "/" }],
    tags: [
      {
        name: "Warehouses",
        description:
          "Warehouse registry: creation, listing, lookup, update and deletion.",
      },
      {
        name: "Categories",
        description:
          "Product category registry: creation, listing, lookup, update and deletion.",
      },
      {
        name: "Images",
        description:
          "Reusable image registry: creation, listing, lookup, update and deletion.",
      },
      {
        name: "Products",
        description:
          "Catalog products linked to a category and an image: creation, listing, lookup, update and deletion.",
      },
      {
        name: "States",
        description:
          "Venezuelan states catalog: creation, listing, lookup, update and deletion.",
      },
      {
        name: "Cities",
        description:
          "Cities catalog linked to a state: creation, listing, lookup, update and deletion.",
      },
      {
        name: "Suppliers",
        description:
          "Supplier registry with contact data and location: creation, listing, lookup, update and deletion.",
      },
      {
        name: "Item states",
        description:
          "Product item state catalog (sellable, damaged, expired, etc.): creation, listing, lookup, update and deletion.",
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },
      responses: {
        InternalServerError: {
          description:
            "Unexpected internal error; the client only receives a generic message",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/InternalServerError" },
            },
          },
        },
        NotFound: {
          description: "The requested route does not exist",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/NotFound" },
            },
          },
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
        Customer: {
          type: "object",
          properties: {
            id: { type: "integer", example: 1 },
            fullName: { type: "string", example: "Juan Pérez" },
            latitude: {
              type: "number",
              description: "Latitude with up to 7 decimals",
              example: -17.7833,
            },
            longitude: {
              type: "number",
              description: "Longitude with up to 7 decimals",
              example: -63.1821,
            },
            direction: {
              type: "string",
              example: "Av. Monseñor Rivero 123",
            },
            email: {
              type: "string",
              format: "email",
              example: "juan@example.com",
            },
          },
        },
        Warehouse: {
          type: "object",
          properties: {
            id: { type: "integer", example: 1 },
            name: { type: "string", example: "Bodega Central" },
            observations: {
              type: "string",
              nullable: true,
              example: "Horario de 8 a 18",
            },
            address: {
              type: "string",
              example: "Av. Monseñor Rivero 123",
            },
          },
        },
        Category: {
          type: "object",
          properties: {
            id: { type: "integer", example: 1 },
            name: { type: "string", example: "Analgésicos" },
          },
        },
        Image: {
          type: "object",
          properties: {
            id: { type: "integer", example: 1 },
            url: {
              type: "string",
              format: "uri",
              example: "https://cdn.farmamad.com/products/ibuprofeno.png",
            },
            pathname: {
              type: "string",
              nullable: true,
              example: "/uploads/products/ibuprofeno.png",
            },
            reference: { type: "string", example: "ibuprofeno-400" },
            thumbnail: {
              type: "string",
              format: "uri",
              example: "https://cdn.farmamad.com/products/ibuprofeno-thumb.png",
            },
          },
        },
        Product: {
          type: "object",
          properties: {
            id: { type: "integer", example: 1 },
            name: { type: "string", example: "Ibuprofeno 400 mg" },
            description: {
              type: "string",
              example: "Analgésico y antiinflamatorio",
            },
            reference: { type: "string", example: "IBU-400" },
            category_id: { type: "integer", example: 1 },
            image_id: { type: "integer", example: 1 },
          },
        },
        State: {
          type: "object",
          properties: {
            id: { type: "integer", example: 1 },
            name: { type: "string", example: "Aragua" },
            code: { type: "string", example: "VE-D" },
          },
        },
        City: {
          type: "object",
          properties: {
            id: { type: "integer", example: 10 },
            name: { type: "string", example: "Maracay" },
            state_id: { type: "integer", example: 4 },
            state: {
              $ref: "#/components/schemas/State",
              description:
                "Only present when the list is requested with include=state",
            },
          },
        },
        Supplier: {
          type: "object",
          properties: {
            id: { type: "integer", example: 1 },
            name: {
              type: "string",
              example: "Distribuidora La Salud C.A.",
            },
            identification: {
              type: "string",
              description:
                "Unique ignoring case; stored uppercase and kept as text",
              example: "J-12345678-9",
            },
            email: {
              type: "string",
              format: "email",
              example: "ventas@lasalud.com",
            },
            phone: {
              type: "string",
              example: "+58 212 555-1234",
            },
            observations: {
              type: "string",
              nullable: true,
              example: "Entrega los martes",
            },
            address: {
              type: "string",
              example: "Av. Principal, Galpón 4",
            },
            city_id: { type: "integer", example: 10 },
            state_id: { type: "integer", example: 4 },
            city: {
              type: "object",
              description:
                "Nested city; present in the listing, the detail and POST with include=location",
              properties: {
                id: { type: "integer", example: 10 },
                name: { type: "string", example: "Maracay" },
              },
            },
            state: {
              $ref: "#/components/schemas/State",
            },
          },
        },
        ItemState: {
          type: "object",
          properties: {
            id: { type: "integer", example: 1 },
            name: {
              type: "string",
              description:
                "Stable snake_case key, unique ignoring case, 2–50 characters",
              example: "sellable",
            },
            label: {
              type: "string",
              description: "Visible text, 2–100 characters",
              example: "Vendible",
            },
            description: {
              type: "string",
              nullable: true,
              example: "Producto apto para la venta",
            },
            is_sellable: {
              type: "boolean",
              description:
                "Whether a product in this state can, in principle, be sold",
              example: true,
            },
          },
        },
        ErrorMessage: {
          type: "object",
          properties: { message: { type: "string" } },
        },
        InternalServerError: {
          type: "object",
          description: "Generic error body that never leaks the real cause",
          properties: {
            message: { type: "string", example: "Internal server error" },
          },
        },
        NotFound: {
          type: "object",
          description: "Body returned for unknown routes",
          properties: {
            message: { type: "string", example: "Not found" },
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
