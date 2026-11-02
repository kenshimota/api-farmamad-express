const {
  CURRENCY_INCLUDE,
  CUSTOMER_INCLUDE,
  ITEM_INCLUDE,
  LIST_ORDER,
  PAYMENT_TERM_INCLUDE,
} = require("./includes");
const { buildDayRange, buildNumberSearch } = require("../shared/list-query");

/**
 * Builds the Sequelize options for the invoice listing.
 * @param {object} [filters] - Listing filters.
 * @param {number} [filters.orderId] - Exact order id.
 * @param {number} [filters.customerId] - Exact customer id.
 * @param {number} [filters.number] - Exact invoice number.
 * @param {string} [filters.paymentStatus] - Exact payment status.
 * @param {boolean} [filters.includeItems] - Nest the invoice lines.
 * @returns {object} Options accepted by `Invoice.findAll`.
 */
function buildListOptions(
  {
    orderId,
    customerId,
    number,
    paymentStatus,
    from,
    to,
    dueFrom,
    dueTo,
    q,
    includeItems = false,
  } = {},
  order = LIST_ORDER,
) {
  const options = { order };
  const where = {};

  if (orderId !== undefined) {
    where.order_id = orderId;
  }

  if (customerId !== undefined) {
    where.customer_id = customerId;
  }

  if (number !== undefined) {
    where.number = number;
  }

  if (paymentStatus !== undefined) {
    where.payment_status = paymentStatus;
  }

  const issuedRange = buildDayRange("issued_at", from, to);

  if (issuedRange) {
    Object.assign(where, issuedRange);
  }

  const dueRange = buildDayRange("due_date", dueFrom, dueTo, {
    dateOnly: true,
  });

  if (dueRange) {
    Object.assign(where, dueRange);
  }

  const search = buildNumberSearch(q, ["number"]);

  if (search) {
    Object.assign(where, search);
  }

  if (Reflect.ownKeys(where).length > 0) {
    options.where = where;
  }

  options.include = [CUSTOMER_INCLUDE, CURRENCY_INCLUDE, PAYMENT_TERM_INCLUDE];

  if (includeItems) {
    options.include.push(ITEM_INCLUDE);
  }

  return options;
}

module.exports = { buildListOptions };
