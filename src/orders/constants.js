const ORDER_STATUSES = Object.freeze({
  DRAFT: "draft",
  REQUEST: "request",
  GENERATE: "generate",
  INVOICED: "invoiced",
  CANCELLED: "cancelled",
});
const BASE_STATUS_CODES = Object.freeze(Object.values(ORDER_STATUSES));
const EVENTS = Object.freeze({
  CREATED: "created",
  ITEM_ADDED: "item_added",
  ITEM_UPDATED: "item_updated",
  ITEM_REMOVED: "item_removed",
  STATUS_CHANGED: "status_changed",
  INVOICE_ISSUED: "invoice_issued",
});
const MAX_ITEMS = 50;
const CUSTOMER_ROLE = "customer";
const INTERNAL_ROLES = Object.freeze(["admin", "seller"]);
const ALLOWED_ROLES = Object.freeze(["customer", "admin", "seller"]);
const EDITABLE_STATUSES = Object.freeze([
  ORDER_STATUSES.DRAFT,
  ORDER_STATUSES.REQUEST,
]);
const ORDER_STATUS_INCOMPLETE_MESSAGE =
  "Order status configuration is incomplete";

module.exports = {
  ALLOWED_ROLES,
  BASE_STATUS_CODES,
  CUSTOMER_ROLE,
  EDITABLE_STATUSES,
  EVENTS,
  INTERNAL_ROLES,
  MAX_ITEMS,
  ORDER_STATUSES,
  ORDER_STATUS_INCOMPLETE_MESSAGE,
};
