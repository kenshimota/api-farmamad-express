/**
 * OpenAPI schemas for the product catalog: the product itself and the
 * category and image entities it references. They live in their own module so
 * the shared schema registry stays focused and below the file size limit.
 */
module.exports = {
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
      tax_id: {
        type: "integer",
        description:
          "Existing tax id; the tax entity is not nested in the response",
        example: 1,
      },
    },
  },
};
