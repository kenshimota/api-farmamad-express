const { toPublicState } = require("../states/serializer");

/**
 * Reads a field from a Sequelize instance or a plain object.
 * @param {object} city - Sequelize instance or plain object.
 * @param {string} field - Field name.
 * @returns {unknown} The raw value.
 */
function readField(city, field) {
  return typeof city.get === "function" ? city.get(field) : city[field];
}

/**
 * Builds the public representation of a city: `id`, `name` and `state_id` with
 * no audit columns. The nested `state` is added only when it was loaded
 * through `include=state`.
 * @param {object} city - City instance or plain object.
 * @param {object} [options] - Serialization options.
 * @param {boolean} [options.includeState] - Include the nested state.
 * @returns {{ id: number, name: string, state_id: number, state?: object }}
 *   Public data.
 */
function toPublicCity(city, { includeState = false } = {}) {
  const data = {
    id: readField(city, "id"),
    name: readField(city, "name"),
    state_id: readField(city, "state_id"),
  };
  const state = readField(city, "state");

  if (includeState && state) {
    data.state = toPublicState(state);
  }

  return data;
}

module.exports = { toPublicCity };
