const storeSchemas = {
  StoreItemState: {
    type: "object",
    description: "Item state exposed by the store catalog",
    properties: {
      id: { type: "integer", example: 1 },
      name: { type: "string", example: "sellable" },
      label: { type: "string", example: "Vendible" },
    },
  },
  StoreCurrency: {
    type: "object",
    description: "Active default transaction currency",
    properties: {
      id: { type: "integer", example: 3 },
      code: { type: "string", example: "USD_BCV" },
      name: { type: "string", example: "Dólar BCV" },
      symbol: { type: "string", example: "$" },
    },
  },
  StoreVariant: {
    type: "object",
    description:
      "Priced variant of a product; availability comes from lots, never from stocks.quantity",
    properties: {
      item_state: { $ref: "#/components/schemas/StoreItemState" },
      price: {
        type: "number",
        format: "double",
        description:
          "Resolved price for the customer price list, rounded to two decimals",
        example: 14.29,
      },
      currency_id: { type: "integer", example: 3 },
      currency: { $ref: "#/components/schemas/StoreCurrency" },
      available: {
        type: "boolean",
        description: "True when SUM(lots.stock - lots.reserved) is positive",
        example: true,
      },
    },
  },
  StoreProductVariant: {
    type: "object",
    description:
      "One listing entry per product + sellable item state with resolvable price and availability",
    properties: {
      id: { type: "integer", example: 15 },
      name: { type: "string", example: "Ibuprofeno 400 mg" },
      description: {
        type: "string",
        example: "Analgésico y antiinflamatorio",
      },
      reference: { type: "string", example: "IBU-400" },
      category_id: { type: "integer", example: 2 },
      image_id: { type: "integer", example: 7 },
      item_state: { $ref: "#/components/schemas/StoreItemState" },
      price: { type: "number", format: "double", example: 14.29 },
      currency_id: { type: "integer", example: 3 },
      currency: { $ref: "#/components/schemas/StoreCurrency" },
      available: { type: "boolean", example: true },
      category: { $ref: "#/components/schemas/Category" },
      image: { $ref: "#/components/schemas/Image" },
    },
  },
  StoreProductDetail: {
    type: "object",
    description: "Product fields and every priced variant",
    properties: {
      id: { type: "integer", example: 15 },
      name: { type: "string", example: "Ibuprofeno 400 mg" },
      description: {
        type: "string",
        example: "Analgésico y antiinflamatorio",
      },
      reference: { type: "string", example: "IBU-400" },
      category_id: { type: "integer", example: 2 },
      image_id: { type: "integer", example: 7 },
      category: { $ref: "#/components/schemas/Category" },
      image: { $ref: "#/components/schemas/Image" },
      variants: {
        type: "array",
        items: { $ref: "#/components/schemas/StoreVariant" },
      },
    },
  },
};

module.exports = storeSchemas;
