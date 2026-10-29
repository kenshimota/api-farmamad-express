const { toPublicCurrencySummary } = require("../currencies/serializer");
const { readField, toDecimalNumber } = require("../shared/serializer");

/**
 * Converts the DECIMAL value returned by Sequelize (usually a string) into a
 * JSON number rounded to two decimals. Invalid values become null.
 * @param {unknown} value - Raw DECIMAL value.
 * @returns {number|null} The numeric cost or null when it is not numeric.
 */
function toCostNumber(value) {
  return toDecimalNumber(value, 2);
}

/**
 * Builds the nested item state included in every cost response. Only the
 * documented fields are exposed; the description and audit columns are left
 * out on purpose.
 * @param {object} itemState - Item state instance or plain object.
 * @returns {{ id: number, name: string, label: string,
 *   is_sellable: boolean }} Public item state data.
 */
function toPublicCostItemState(itemState) {
  return {
    id: readField(itemState, "id"),
    name: readField(itemState, "name"),
    label: readField(itemState, "label"),
    is_sellable: readField(itemState, "is_sellable"),
  };
}

/**
 * Builds the public representation of a cost: only `id`, `product_id`,
 * `item_state_id`, the numeric `cost`, the currency and the nested item state,
 * with no audit columns.
 * @param {object} cost - Cost instance or plain object.
 * @param {object} [itemState] - Nested item state when it is passed apart.
 * @param {object} [currency] - Nested currency when it is passed apart.
 * @returns {{ id: number, product_id: number, item_state_id: number,
 *   cost: number|null, currency_id: number|null, currency: object|null,
 *   item_state: object|null }} Public data.
 */
function toPublicCost(
  cost,
  itemState = readField(cost, "item_state"),
  currency = readField(cost, "currency"),
) {
  return {
    id: readField(cost, "id"),
    product_id: readField(cost, "product_id"),
    item_state_id: readField(cost, "item_state_id"),
    cost: toCostNumber(readField(cost, "cost")),
    currency_id: readField(cost, "currency_id") ?? null,
    currency: currency ? toPublicCurrencySummary(currency) : null,
    item_state: itemState ? toPublicCostItemState(itemState) : null,
  };
}

module.exports = { toCostNumber, toPublicCost, toPublicCostItemState };
