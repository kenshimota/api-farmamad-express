const BASE_STATUS_CODES = Object.freeze([
  "draft",
  "request",
  "generate",
  "invoiced",
  "cancelled",
]);
const CODE_PATTERN = /^[a-z][a-z0-9_]{1,19}$/;
const COMPLETE_MESSAGE = "Order status configuration is incomplete";

module.exports = {
  BASE_STATUS_CODES,
  CODE_PATTERN,
  COMPLETE_MESSAGE,
};
