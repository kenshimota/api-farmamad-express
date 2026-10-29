const path = require("path");
const swaggerJsdoc = require("swagger-jsdoc");
const schemas = require("./swagger-schemas");

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
      {
        name: "Costs",
        description:
          "Current cost of a product per item state: creation, listing, lookup, update and deletion.",
      },
      {
        name: "Stocks",
        description:
          "Read-only inventory per product and item state, including the sellable stock with its current cost.",
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
      schemas,
    },
  },
  apis: [path.join(__dirname, "..", "**", "*.js")],
});

module.exports = swaggerSpec;
