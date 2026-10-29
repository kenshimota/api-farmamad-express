/**
 * Reads a field from a Sequelize instance or a plain object.
 * @param {object} warehouse - Sequelize instance or plain object.
 * @param {string} field - Field name.
 * @returns {unknown} The raw value.
 */
function readField(warehouse, field) {
  return typeof warehouse.get === "function"
    ? warehouse.get(field)
    : warehouse[field];
}

/**
 * Builds the public representation of a warehouse: only `id`, `name`,
 * `observations` and `address`, with no audit columns or internal fields.
 * @param {object} warehouse - Warehouse instance or plain object.
 * @returns {{ id: number, name: string, observations: string|null,
 *   address: string }} Public data.
 */
function toPublicWarehouse(warehouse) {
  return {
    id: readField(warehouse, "id"),
    name: readField(warehouse, "name"),
    observations: readField(warehouse, "observations"),
    address: readField(warehouse, "address"),
  };
}

module.exports = { toPublicWarehouse };
