const authSchemas = require("./swagger-auth-schemas");
const purchaseSchemas = require("./swagger-purchase-schemas");
const currencySchemas = require("./swagger-currency-schemas");
const shelfSchemas = require("./swagger-shelf-schemas");
const lotSchemas = require("./swagger-lot-schemas");
const customerSellerSchemas = require("./swagger-customer-seller-schemas");
const taxSchemas = require("./swagger-tax-schemas");
const methodPaymentTypeSchemas = require("./swagger-method-payment-type-schemas");
const methodPaymentSchemas = require("./swagger-method-payment-schemas");
const customerSchemas = require("./swagger-customer-schemas");
const CURRENCY_SUMMARY = { $ref: "#/components/schemas/CurrencySummary" };
const schemas = {
  ...authSchemas,
  ...customerSchemas,
  ...purchaseSchemas,
  ...currencySchemas,
  ...shelfSchemas,
  ...lotSchemas,
  ...customerSellerSchemas,
  ...taxSchemas,
  ...methodPaymentTypeSchemas,
  ...methodPaymentSchemas,
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
        description: "Unique ignoring case; stored uppercase and kept as text",
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
  Cost: {
    type: "object",
    properties: {
      id: { type: "integer", example: 1 },
      product_id: { type: "integer", example: 15 },
      item_state_id: { type: "integer", example: 2 },
      cost: {
        type: "number",
        format: "double",
        description:
          "Current cost with DECIMAL(12,2) precision, serialized as a number",
        example: 12.5,
      },
      currency_id: { type: "integer", example: 3 },
      currency: { ...CURRENCY_SUMMARY },
      item_state: {
        type: "object",
        description: "Nested item state without description or audit fields",
        properties: {
          id: { type: "integer", example: 2 },
          name: { type: "string", example: "damaged" },
          label: { type: "string", example: "Maltratado" },
          is_sellable: { type: "boolean", example: false },
        },
      },
    },
  },
  Stock: {
    type: "object",
    properties: {
      id: { type: "integer", example: 3 },
      product_id: { type: "integer", example: 15 },
      item_state_id: { type: "integer", example: 1 },
      quantity: { type: "integer", minimum: 0, example: 40 },
      item_state: {
        type: "object",
        description: "Nested item state without description or audit fields",
        properties: {
          id: { type: "integer", example: 1 },
          name: { type: "string", example: "sellable" },
          label: { type: "string", example: "Vendible" },
          is_sellable: { type: "boolean", example: true },
        },
      },
    },
  },
  AvailableStock: {
    type: "object",
    properties: {
      product_id: { type: "integer", example: 15 },
      item_state_id: { type: "integer", example: 1 },
      quantity: { type: "integer", minimum: 1, example: 40 },
      cost: {
        type: "number",
        format: "double",
        nullable: true,
        description: "Current cost of the combination or null when missing",
        example: 20,
      },
      currency_id: { type: "integer", nullable: true, example: 3 },
      currency: { ...CURRENCY_SUMMARY, nullable: true },
      item_state: {
        type: "object",
        description: "Nested sellable item state",
        properties: {
          id: { type: "integer", example: 1 },
          name: { type: "string", example: "sellable" },
          label: { type: "string", example: "Vendible" },
          is_sellable: { type: "boolean", example: true },
        },
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
};
module.exports = schemas;
