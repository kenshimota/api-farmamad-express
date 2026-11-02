const swaggerSpec = require("./swagger");

/**
 * Reads the multipart content of a product write operation.
 * @param {string} path - Swagger path.
 * @param {string} method - HTTP method.
 * @returns {object} Multipart media type object.
 */
function multipart(path, method) {
  return swaggerSpec.paths[path][method].requestBody.content[
    "multipart/form-data"
  ];
}

describe("Swagger product uploads", () => {
  it.each([
    ["/products", "post"],
    ["/products/{id}", "put"],
  ])("documents multipart/form-data for %s %s", (path, method) => {
    const content = multipart(path, method);

    expect(content.schema.properties.image).toMatchObject({
      type: "string",
      format: "binary",
    });
    expect(content.schema.properties.image_id).toBeDefined();
    expect(content.schema.properties.tax_id).toMatchObject({
      type: "integer",
      minimum: 1,
    });
    expect(content.schema.required).toContain("tax_id");
    expect(content.schema.required).not.toContain("image");
    expect(content.schema.required).not.toContain("image_id");
  });
});
