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
 * Builds the nested price list summary exposed in customer responses. The
 * internal margin percentage and the description are intentionally left out so
 * the customer never sees how the price is calculated.
 * @param {object} priceList - Price list instance or plain object.
 * @returns {{ id: number, name: string }} Public summary.
 */
function toPublicCustomerPriceList(priceList) {
  return {
    id: readField(priceList, "id"),
    name: readField(priceList, "name"),
  };
}

/**
 * Builds the public representation of a customer: only `id`, `fullName`,
 * `latitude`, `longitude`, `direction`, `email`, `price_list_id` and the
 * nested `price_list` summary, with the coordinates as numbers and no audit
 * columns or internal fields.
 * @param {object} customer - Customer instance or plain object.
 * @returns {{ id: number, fullName: string, latitude: number|null,
 *   longitude: number|null, direction: string, email: string,
 *   price_list_id: number|null, price_list: object|null }} Public data.
 */
function toPublicCustomer(customer) {
  const priceList = readField(customer, "price_list");
  const priceListId =
    readField(customer, "price_list_id") ??
    (priceList ? readField(priceList, "id") : null) ??
    null;

  return {
    id: readField(customer, "id"),
    fullName: readField(customer, "fullName"),
    latitude: toNumber(readField(customer, "latitude")),
    longitude: toNumber(readField(customer, "longitude")),
    direction: readField(customer, "direction"),
    email: readField(customer, "email"),
    price_list_id: priceListId,
    price_list: priceList ? toPublicCustomerPriceList(priceList) : null,
  };
}

module.exports = { toPublicCustomer, toPublicCustomerPriceList };
