const { readField } = require("../shared/serializer");
const { toQuantity } = require("./picking-values");
const {
  compareAllocations,
  toPickingAllocation,
} = require("./picking-lot-serializer");

/**
 * Builds the product summary nested in a picking line.
 * @param {object} product - Product instance or plain object.
 * @returns {object|null} Public product data.
 */
function toPickingProduct(product) {
  if (!product) {
    return null;
  }

  return {
    id: readField(product, "id"),
    name: readField(product, "name"),
    reference: readField(product, "reference"),
    image_id: readField(product, "image_id"),
  };
}

/**
 * Builds the item state summary nested in a picking line.
 * @param {object} itemState - Item state instance or plain object.
 * @returns {object|null} Public item state data.
 */
function toPickingItemState(itemState) {
  if (!itemState) {
    return null;
  }

  return {
    id: readField(itemState, "id"),
    name: readField(itemState, "name"),
    label: readField(itemState, "label"),
  };
}

/**
 * Builds a picking line with its allocations ordered FEFO.
 * @param {object} item - Order item instance or plain object.
 * @returns {object} Public picking line.
 */
function toPickingItem(item) {
  const quantity = toQuantity(readField(item, "quantity"));
  const allocations = readField(item, "allocations");
  const lots = (Array.isArray(allocations) ? [...allocations] : [])
    .sort(compareAllocations)
    .map((allocation) => toPickingAllocation(allocation));
  const allocated = lots.reduce(
    (total, allocation) => total + allocation.quantity,
    0,
  );

  return {
    order_item_id: readField(item, "id"),
    product_id: readField(item, "product_id"),
    item_state_id: readField(item, "item_state_id"),
    quantity,
    allocated_quantity: allocated,
    pending_quantity: Math.max(0, quantity - allocated),
    product: toPickingProduct(readField(item, "product")),
    item_state: toPickingItemState(readField(item, "item_state")),
    lots,
  };
}

module.exports = {
  toPickingItem,
  toPickingItemState,
  toPickingProduct,
};
