/**
 * Reads a field from a Sequelize instance or a plain object.
 * @param {object} product - Sequelize instance or plain object.
 * @param {string} field - Field name.
 * @returns {unknown} The raw value.
 */
function readField(product, field) {
  return typeof product.get === "function"
    ? product.get(field)
    : product[field];
}

/**
 * Builds the public representation of a product: only `id`, `name`,
 * `description`, `reference`, `category_id`, `image_id` and `tax_id`, with no
 * audit columns or internal fields. The tax entity is not nested; clients can
 * read it through `GET /taxes/:id`.
 * @param {object} product - Product instance or plain object.
 * @returns {{ id: number, name: string, description: string,
 *   reference: string, category_id: number, image_id: number,
 *   tax_id: number }} Public data.
 */
function toPublicProduct(product) {
  return {
    id: readField(product, "id"),
    name: readField(product, "name"),
    description: readField(product, "description"),
    reference: readField(product, "reference"),
    category_id: readField(product, "category_id"),
    image_id: readField(product, "image_id"),
    tax_id: readField(product, "tax_id"),
  };
}

module.exports = { toPublicProduct };
