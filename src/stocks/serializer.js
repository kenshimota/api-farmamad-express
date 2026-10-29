const { toCostNumber } = require("../costs/serializer");
const { toPublicCurrencySummary } = require("../currencies/serializer");
const { readField } = require("../shared/serializer");

/**
 * Builds the nested item state included in every stock response. Only the
 * documented fields are exposed; the description and audit columns are left
 * out on purpose.
 * @param {object} itemState - Item state instance or plain object.
 * @returns {{ id: number, name: string, label: string,
 *   is_sellable: boolean }} Public item state data.
 */
function toPublicStockItemState(itemState) {
  return {
    id: readField(itemState, "id"),
    name: readField(itemState, "name"),
    label: readField(itemState, "label"),
    is_sellable: readField(itemState, "is_sellable"),
  };
}

/**
 * Builds the public representation of a stock row: only `id`, `product_id`,
 * `item_state_id`, `quantity` and the nested `item_state`, with no audit
 * columns.
 * @param {object} stock - Stock instance or plain object.
 * @param {object} [itemState] - Nested item state when it is passed apart.
 * @returns {{ id: number, product_id: number, item_state_id: number,
 *   quantity: number, item_state: object|null }} Public data.
 */
function toPublicStock(stock, itemState = readField(stock, "item_state")) {
  return {
    id: readField(stock, "id"),
    product_id: readField(stock, "product_id"),
    item_state_id: readField(stock, "item_state_id"),
    quantity: readField(stock, "quantity"),
    item_state: itemState ? toPublicStockItemState(itemState) : null,
  };
}

/**
 * Builds the public representation of an available stock row. The current cost
 * and its currency are exposed as null when the combination has no registered
 * cost, so the missing value stays visible to the client.
 * @param {object} stock - Stock instance or plain object with its cost.
 * @returns {{ product_id: number, item_state_id: number, quantity: number,
 *   cost: number|null, currency_id: number|null, currency: object|null,
 *   item_state: object|null }} Public data.
 */
function toAvailableStock(stock) {
  const cost = readField(stock, "cost");
  const currency = cost ? readField(cost, "currency") : null;
  const itemState = readField(stock, "item_state");

  return {
    product_id: readField(stock, "product_id"),
    item_state_id: readField(stock, "item_state_id"),
    quantity: readField(stock, "quantity"),
    cost: cost ? toCostNumber(readField(cost, "cost")) : null,
    currency_id: cost ? (readField(cost, "currency_id") ?? null) : null,
    currency: currency ? toPublicCurrencySummary(currency) : null,
    item_state: itemState ? toPublicStockItemState(itemState) : null,
  };
}

module.exports = {
  toAvailableStock,
  toPublicStock,
  toPublicStockItemState,
};
