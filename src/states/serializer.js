/**
 * Reads a field from a Sequelize instance or a plain object.
 * @param {object} state - Sequelize instance or plain object.
 * @param {string} field - Field name.
 * @returns {unknown} The raw value.
 */
function readField(state, field) {
  return typeof state.get === "function" ? state.get(field) : state[field];
}

/**
 * Builds the public representation of a state: only `id`, `name` and `code`,
 * with no audit columns or internal fields.
 * @param {object} state - State instance or plain object.
 * @returns {{ id: number, name: string, code: string }} Public data.
 */
function toPublicState(state) {
  return {
    id: readField(state, "id"),
    name: readField(state, "name"),
    code: readField(state, "code"),
  };
}

module.exports = { toPublicState };
