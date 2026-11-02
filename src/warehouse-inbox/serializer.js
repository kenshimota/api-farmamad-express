const {
  readField,
  toIsoOrNull,
  toPublicRelation,
} = require("../lots/serializer");

/**
 * Selects the purchase item that links the lot back to its purchase.
 * @param {object} lot - Lot instance.
 * @returns {object|null} The purchase item or null.
 */
function firstPurchaseItem(lot) {
  const items = readField(lot, "purchase_items");

  return Array.isArray(items) && items.length > 0 ? items[0] : null;
}

/**
 * Builds the public representation of an inbox lot. `available` is zero until
 * the lot is located, because pending stock cannot be sold or reserved.
 * @param {object} lot - Lot instance or plain object.
 * @param {object} [options] - Serialization options.
 * @param {boolean} [options.userObjects] - When true `located_by` is exposed as
 *   the nested user object (inbox listing). When false it stays as the raw id,
 *   matching the start/location response fragments.
 * @returns {object} Public inbox lot.
 */
function toPublicInboxLot(lot, { userObjects = true } = {}) {
  const stock = Number(readField(lot, "stock") ?? 0);
  const reserved = Number(readField(lot, "reserved") ?? 0);
  const status = readField(lot, "location_status") ?? "pending";
  const purchaseItem = firstPurchaseItem(lot);
  const purchase = purchaseItem ? readField(purchaseItem, "purchase") : null;
  const startedBy = toPublicRelation(readField(lot, "started_by"), [
    "id",
    "username",
  ]);
  const locatedByUser = toPublicRelation(readField(lot, "located_by_user"), [
    "id",
    "username",
  ]);

  return {
    id: readField(lot, "id"),
    number: readField(lot, "number"),
    product_id: readField(lot, "product_id"),
    expiration_date: readField(lot, "expiration_date"),
    item_state_id: readField(lot, "item_state_id"),
    stock,
    reserved,
    available: status === "located" ? stock - reserved : 0,
    warehouse_id: readField(lot, "warehouse_id") ?? null,
    shelf_id: readField(lot, "shelf_id") ?? null,
    section_id: readField(lot, "section_id") ?? null,
    location_status: status,
    location_started_at: toIsoOrNull(readField(lot, "location_started_at")),
    location_started_by: readField(lot, "location_started_by") ?? null,
    located_at: toIsoOrNull(readField(lot, "located_at")),
    located_by: userObjects
      ? locatedByUser
      : (readField(lot, "located_by") ?? null),
    created_at: toIsoOrNull(readField(lot, "createdAt")),
    product: toPublicRelation(readField(lot, "product"), [
      "id",
      "name",
      "reference",
    ]),
    item_state: toPublicRelation(readField(lot, "item_state"), [
      "id",
      "name",
      "label",
    ]),
    purchase: toPublicRelation(purchase, ["id", "number", "supplier_id"]),
    purchase_item_id: purchaseItem ? readField(purchaseItem, "id") : null,
    started_by: startedBy,
  };
}

module.exports = { toPublicInboxLot };
