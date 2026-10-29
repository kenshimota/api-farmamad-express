const { toPublicState } = require("../states/serializer");

/**
 * Reads a field from a Sequelize instance or a plain object.
 * @param {object} supplier - Sequelize instance or plain object.
 * @param {string} field - Field name.
 * @returns {unknown} The raw value.
 */
function readField(supplier, field) {
  return typeof supplier.get === "function"
    ? supplier.get(field)
    : supplier[field];
}

/**
 * Builds the public representation of a supplier: the documented columns with
 * no audit fields. The nested `city` and `state` are added only when they were
 * loaded and `includeLocation` is requested.
 * @param {object} supplier - Supplier instance or plain object.
 * @param {object} [options] - Serialization options.
 * @param {boolean} [options.includeLocation] - Include city and state.
 * @returns {object} Public supplier data.
 */
function toPublicSupplier(supplier, { includeLocation = false } = {}) {
  const data = {
    id: readField(supplier, "id"),
    name: readField(supplier, "name"),
    identification: readField(supplier, "identification"),
    email: readField(supplier, "email"),
    phone: readField(supplier, "phone"),
    observations: readField(supplier, "observations"),
    address: readField(supplier, "address"),
    city_id: readField(supplier, "city_id"),
    state_id: readField(supplier, "state_id"),
  };
  const city = readField(supplier, "city");
  const state = readField(supplier, "state");

  if (includeLocation && city) {
    data.city = {
      id: readField(city, "id"),
      name: readField(city, "name"),
    };
  }

  if (includeLocation && state) {
    data.state = toPublicState(state);
  }

  return data;
}

module.exports = { toPublicSupplier };
