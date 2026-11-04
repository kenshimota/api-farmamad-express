const { readField } = require("../shared/serializer");
const { toIso } = require("./serializer");
const { toPickingItem } = require("./picking-item-serializer");
const { toPickingSummary } = require("./picking-summary");
const { toDateOnly } = require("./picking-values");

/**
 * Builds the order header block of the picking view.
 * @param {object} order - Order instance or plain object.
 * @returns {object} Public order header.
 */
function toPickingOrderHeader(order) {
  return {
    id: readField(order, "id"),
    number: readField(order, "number"),
    status: readField(order, "status"),
    customer_id: readField(order, "customer_id"),
    delivery_address: readField(order, "delivery_address"),
    notes: readField(order, "notes") ?? null,
    created_at: toIso(readField(order, "createdAt")),
  };
}

/**
 * Builds the customer block with the delivery data.
 * @param {object|null} customer - Customer instance or plain object.
 * @returns {object|null} Public customer data.
 */
function toPickingCustomer(customer) {
  if (!customer) {
    return null;
  }

  return {
    id: readField(customer, "id"),
    fullName: readField(customer, "fullName"),
    email: readField(customer, "email"),
    direction: readField(customer, "direction"),
  };
}

/**
 * Sorts the raw lines by id ascending before serializing them.
 * @param {unknown} rawItems - Raw order lines.
 * @returns {object[]} Sorted raw lines.
 */
function sortItemsById(rawItems) {
  return (Array.isArray(rawItems) ? [...rawItems] : []).sort(
    (left, right) =>
      Number(readField(left, "id") ?? 0) - Number(readField(right, "id") ?? 0),
  );
}

/**
 * Facade that builds the full picking response from the order loaded by the
 * picking repository, delegating each block to its own serializer.
 * @param {object} order - Order loaded by the picking repository.
 * @returns {{ order: object, customer: object|null, summary: object,
 *   items: object[] }} The picking response.
 */
function toPickingResponse(order) {
  const items = sortItemsById(readField(order, "items")).map((item) =>
    toPickingItem(item),
  );

  return {
    order: toPickingOrderHeader(order),
    customer: toPickingCustomer(readField(order, "customer")),
    summary: toPickingSummary(items),
    items,
  };
}

module.exports = {
  toDateOnly,
  toPickingResponse,
};
