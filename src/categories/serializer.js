/**
 * Reads a field from a Sequelize instance or a plain object.
 * @param {object} category - Sequelize instance or plain object.
 * @param {string} field - Field name.
 * @returns {unknown} The raw value.
 */
function readField(category, field) {
  return typeof category.get === "function"
    ? category.get(field)
    : category[field];
}

/**
 * Builds the public representation of a category: only `id` and `name`, with
 * no audit columns or internal fields.
 * @param {object} category - Category instance or plain object.
 * @returns {{ id: number, name: string }} Public data.
 */
function toPublicCategory(category) {
  return {
    id: readField(category, "id"),
    name: readField(category, "name"),
  };
}

module.exports = { toPublicCategory };
