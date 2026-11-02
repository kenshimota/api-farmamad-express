const PurchaseItem = require("../models/purchase-item");
const Currency = require("../models/currency");
const { CURRENCY_SUMMARY_ATTRIBUTES } = require("../currencies/attributes");
const { ITEM_ORDER } = require("./item-repository");
const { buildDayRange, buildNumberSearch } = require("../shared/list-query");

const LIST_ORDER = Object.freeze([["number", "DESC"]]);
const SORT_FIELDS = Object.freeze([
  "id",
  "number",
  "status",
  "supplier_id",
  "currency_id",
  "total",
  "createdAt",
]);
const ITEM_INCLUDE = Object.freeze({
  model: PurchaseItem,
  as: "items",
  separate: true,
  order: ITEM_ORDER,
});
const CURRENCY_INCLUDE = Object.freeze({
  model: Currency,
  as: "currency",
  attributes: [...CURRENCY_SUMMARY_ATTRIBUTES],
});

/**
 * Builds the Sequelize options for the purchase listing.
 * @param {object} [filters] - Listing filters.
 * @param {number} [filters.supplierId] - Exact supplier id.
 * @param {string} [filters.status] - Exact status.
 * @param {number} [filters.number] - Exact purchase number.
 * @param {number} [filters.currencyId] - Exact currency id.
 * @param {string} [filters.from] - Inclusive created date.
 * @param {string} [filters.to] - Inclusive created date.
 * @param {string} [filters.q] - Partial number search.
 * @param {boolean} [filters.includeItems] - Nest the purchase lines.
 * @param {Array<[string, string]>} [order] - Order clauses.
 * @returns {object} Options accepted by `Purchase.findAll`.
 */
function buildListOptions(
  {
    supplierId,
    status,
    number,
    currencyId,
    from,
    to,
    q,
    includeItems = false,
  } = {},
  order = LIST_ORDER,
) {
  const options = { order };
  const where = {};

  if (supplierId !== undefined) {
    where.supplier_id = supplierId;
  }

  if (status !== undefined) {
    where.status = status;
  }

  if (number !== undefined) {
    where.number = number;
  }

  if (currencyId !== undefined) {
    where.currency_id = currencyId;
  }

  const range = buildDayRange("createdAt", from, to);

  if (range) {
    Object.assign(where, range);
  }

  const search = buildNumberSearch(q, ["number"]);

  if (search) {
    Object.assign(where, search);
  }

  if (Reflect.ownKeys(where).length > 0) {
    options.where = where;
  }

  options.include = [{ ...CURRENCY_INCLUDE }];

  if (includeItems) {
    options.include.push({ ...ITEM_INCLUDE });
  }

  return options;
}

module.exports = {
  CURRENCY_INCLUDE,
  ITEM_INCLUDE,
  LIST_ORDER,
  SORT_FIELDS,
  buildListOptions,
};
