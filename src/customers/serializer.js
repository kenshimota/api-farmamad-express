/**
 * Reads a field from a Sequelize instance or a plain object.
 * @param {object} customer - Sequelize instance or plain object.
 * @param {string} field - Field name.
 * @returns {unknown} The raw value.
 */
function readField(customer, field) {
  return typeof customer.get === "function"
    ? customer.get(field)
    : customer[field];
}

/**
 * Converts a DECIMAL value (a string when it comes from Postgres) into a JSON
 * number without losing precision. Null and undefined stay null.
 * @param {unknown} value - Raw coordinate value.
 * @returns {number|null} The numeric coordinate or null.
 */
function toNumber(value) {
  if (value === null || value === undefined) {
    return null;
  }

  return Number(value);
}

/**
 * Builds the public representation of a customer: only `id`, `fullName`,
 * `latitude`, `longitude`, `direction` and `email`, with the coordinates as
 * numbers and no audit columns or internal fields.
 * @param {object} customer - Customer instance or plain object.
 * @returns {{ id: number, fullName: string, latitude: number|null,
 *   longitude: number|null, direction: string, email: string }} Public data.
 */
function toPublicCustomer(customer) {
  return {
    id: readField(customer, "id"),
    fullName: readField(customer, "fullName"),
    latitude: toNumber(readField(customer, "latitude")),
    longitude: toNumber(readField(customer, "longitude")),
    direction: readField(customer, "direction"),
    email: readField(customer, "email"),
  };
}

module.exports = { toPublicCustomer };
