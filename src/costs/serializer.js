/**
 * Reads a field from a Sequelize instance or a plain object.
 * @param {object} record - Sequelize instance or plain object.
 * @param {string} field - Field name.
 * @returns {unknown} The raw value.
 */
function readField(record, field) {
  return typeof record.get === "function" ? record.get(field) : record[field];
}

/**
 * Converts the DECIMAL value returned by Sequelize (usually a string) into a
 * JSON number rounded to two decimals. Invalid values become null.
 * @param {unknown} value - Raw DECIMAL value.
 * @returns {number|null} The numeric cost or null when it is not numeric.
 */
function toCostNumber(value) {
  if (
    value === null ||
    value === undefined ||
    (typeof value === "string" && value.trim() === "")
  ) {
    return null;
  }

  const numeric = Number(value);

  if (!Number.isFinite(numeric)) {
    return null;
  }

  return Number(numeric.toFixed(2));
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
 * `item_state_id`, the numeric `cost` and the nested `item_state`, with no
 * audit columns.
 * @param {object} cost - Cost instance or plain object.
 * @param {object} [itemState] - Nested item state when it is passed apart.
 * @returns {{ id: number, product_id: number, item_state_id: number,
 *   cost: number|null, item_state: object|null }} Public data.
 */
function toPublicCost(cost, itemState = readField(cost, "item_state")) {
  return {
    id: readField(cost, "id"),
    product_id: readField(cost, "product_id"),
    item_state_id: readField(cost, "item_state_id"),
    cost: toCostNumber(readField(cost, "cost")),
    item_state: itemState ? toPublicCostItemState(itemState) : null,
  };
}

module.exports = { toCostNumber, toPublicCost, toPublicCostItemState };
