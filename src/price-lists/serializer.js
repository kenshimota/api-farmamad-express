const { readField, toDecimalNumber } = require("../shared/serializer");

/**
 * Builds the public representation of a price list: only `id`, `name`,
 * `description` and the numeric `percentage`, with no audit columns.
 * @param {object} priceList - Price list instance or plain object.
 * @returns {{ id: number, name: string, description: string|null,
 *   percentage: number|null }} Public price list data.
 */
function toPublicPriceList(priceList) {
  return {
    id: readField(priceList, "id"),
    name: readField(priceList, "name"),
    description: readField(priceList, "description") ?? null,
    percentage: toDecimalNumber(readField(priceList, "percentage"), 2),
  };
}

module.exports = { toPublicPriceList };
