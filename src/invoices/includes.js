const InvoiceItem = require("../models/invoice-item");
const PaymentAllocation = require("../models/payment-allocation");
const Payment = require("../models/payment");
const PaymentTerm = require("../models/payment-term");
const Customer = require("../models/customer");
const Currency = require("../models/currency");
const User = require("../models/user");
const { CURRENCY_SUMMARY_ATTRIBUTES } = require("../currencies/attributes");

const LIST_ORDER = Object.freeze([
  ["issued_at", "DESC"],
  ["id", "DESC"],
]);
const CUSTOMER_INCLUDE = Object.freeze({
  model: Customer,
  as: "customer",
  attributes: ["id", "fullName", "email", "direction"],
});
const CURRENCY_INCLUDE = Object.freeze({
  model: Currency,
  as: "currency",
  attributes: [...CURRENCY_SUMMARY_ATTRIBUTES],
});
const PAYMENT_CURRENCY_INCLUDE = Object.freeze({
  model: Currency,
  as: "currency",
  attributes: [...CURRENCY_SUMMARY_ATTRIBUTES],
});
const PAYMENT_TERM_INCLUDE = Object.freeze({
  model: PaymentTerm,
  as: "payment_term",
  attributes: ["id", "code", "name", "days"],
});
const INVOICED_BY_INCLUDE = Object.freeze({
  model: User,
  as: "invoiced_by",
  attributes: ["id", "username", "email"],
});
const ITEM_INCLUDE = Object.freeze({
  model: InvoiceItem,
  as: "items",
  separate: true,
  order: [["id", "ASC"]],
});
const PAYMENT_ALLOCATION_INCLUDE = Object.freeze({
  model: PaymentAllocation,
  as: "payment_allocations",
  order: [
    ["allocated_at", "ASC"],
    ["id", "ASC"],
  ],
  include: [
    {
      model: Payment,
      as: "payment",
      attributes: ["id", "currency_id"],
      include: [PAYMENT_CURRENCY_INCLUDE],
    },
  ],
});

module.exports = {
  CURRENCY_INCLUDE,
  CUSTOMER_INCLUDE,
  INVOICED_BY_INCLUDE,
  ITEM_INCLUDE,
  LIST_ORDER,
  PAYMENT_ALLOCATION_INCLUDE,
  PAYMENT_CURRENCY_INCLUDE,
  PAYMENT_TERM_INCLUDE,
};
