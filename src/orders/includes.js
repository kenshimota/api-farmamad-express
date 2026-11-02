const OrderItem = require("../models/order-item");
const OrderHistory = require("../models/order-history");
const Customer = require("../models/customer");
const User = require("../models/user");
const Currency = require("../models/currency");
const PaymentTerm = require("../models/payment-term");
const Product = require("../models/product");
const ItemState = require("../models/item-state");
const { CURRENCY_SUMMARY_ATTRIBUTES } = require("../currencies/attributes");

const ITEM_ORDER = Object.freeze([["id", "ASC"]]);
const HISTORY_ORDER = Object.freeze([
  ["createdAt", "ASC"],
  ["id", "ASC"],
]);
const ITEM_INCLUDE = Object.freeze({
  model: OrderItem,
  as: "items",
  separate: true,
  order: ITEM_ORDER,
  include: [
    {
      model: Product,
      as: "product",
      attributes: ["id", "name", "reference", "image_id"],
    },
    {
      model: ItemState,
      as: "item_state",
      attributes: ["id", "name", "label"],
    },
  ],
});
const HISTORY_INCLUDE = Object.freeze({
  model: OrderHistory,
  as: "history",
  separate: true,
  order: HISTORY_ORDER,
  include: [
    {
      model: User,
      as: "actor_user",
      attributes: ["id", "username", "email"],
    },
  ],
});
const CUSTOMER_INCLUDE = Object.freeze({
  model: Customer,
  as: "customer",
  attributes: [
    "id",
    "fullName",
    "email",
    "direction",
    "price_list_id",
    "payment_term_id",
  ],
});
const CURRENCY_INCLUDE = Object.freeze({
  model: Currency,
  as: "currency",
  attributes: [...CURRENCY_SUMMARY_ATTRIBUTES, "rate"],
});
const PAYMENT_TERM_INCLUDE = Object.freeze({
  model: PaymentTerm,
  as: "payment_term",
  attributes: ["id", "code", "name", "days", "is_active"],
});

/**
 * Builds the include list of an order detail.
 * @param {object} [options] - Include switches.
 * @param {boolean} [options.includeItems] - Nest the lines.
 * @param {boolean} [options.includeHistory] - Nest the history.
 * @param {boolean} [options.includeCustomer] - Nest the customer.
 * @param {boolean} [options.includeCurrency] - Nest the currency.
 * @param {boolean} [options.includePaymentTerm] - Nest the term.
 * @returns {object[]} Sequelize includes.
 */
function buildOrderIncludes({
  includeItems = true,
  includeHistory = true,
  includeCustomer = true,
  includeCurrency = true,
  includePaymentTerm = true,
} = {}) {
  const includes = [];

  if (includeCustomer) {
    includes.push({ ...CUSTOMER_INCLUDE });
  }

  if (includeCurrency) {
    includes.push({ ...CURRENCY_INCLUDE });
  }

  if (includePaymentTerm) {
    includes.push({ ...PAYMENT_TERM_INCLUDE });
  }

  if (includeItems) {
    includes.push({ ...ITEM_INCLUDE });
  }

  if (includeHistory) {
    includes.push({ ...HISTORY_INCLUDE });
  }

  return includes;
}

module.exports = {
  CURRENCY_INCLUDE,
  CUSTOMER_INCLUDE,
  HISTORY_INCLUDE,
  HISTORY_ORDER,
  ITEM_INCLUDE,
  ITEM_ORDER,
  PAYMENT_TERM_INCLUDE,
  buildOrderIncludes,
};
