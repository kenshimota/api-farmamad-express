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
  },
  apis: [path.join(__dirname, "..", "**", "*.js")],
});

module.exports = swaggerSpec;
