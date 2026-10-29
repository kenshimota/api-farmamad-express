/**
 * Reads a field from a Sequelize instance or a plain object.
 * @param {object} itemState - Sequelize instance or plain object.
 * @param {string} field - Field name.
 * @returns {unknown} The raw value.
 */
function readField(itemState, field) {
  return typeof itemState.get === "function"
    ? itemState.get(field)
    : itemState[field];
}

/**
 * Builds the public representation of an item state: only `id`, `name`,
 * `label`, `description` and `is_sellable`, with no audit columns.
 * @param {object} itemState - Item state instance or plain object.
 * @returns {{ id: number, name: string, label: string,
 *   description: string|null, is_sellable: boolean }} Public data.
 */
function toPublicItemState(itemState) {
  return {
    id: readField(itemState, "id"),
    name: readField(itemState, "name"),
    label: readField(itemState, "label"),
    description: readField(itemState, "description"),
    is_sellable: readField(itemState, "is_sellable"),
  };
}

module.exports = { toPublicItemState };
