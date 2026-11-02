const { resolveQueryFilters } = require("../shared/query-filters");
const {
  EXPIRING_BEFORE_MESSAGE,
  LOT_NUMBER_MESSAGE,
  PRODUCT_ID_MESSAGE,
  PURCHASE_ID_MESSAGE,
  STATUS_MESSAGE,
} = require("./validators");
const {
  parseExpiringBefore,
  parseLotNumber,
  parsePositiveInteger,
  parseStatus,
} = require("./parsers");

/**
 * Strategy table for the optional inbox filters.
 * @type {ReadonlyArray<{ query: string, field: string, parse: Function,
 *   message: string }>}
 */
const QUERY_FILTERS = Object.freeze([
  {
    query: "product_id",
    field: "productId",
    parse: parsePositiveInteger,
    message: PRODUCT_ID_MESSAGE,
  },
  {
    query: "purchase_id",
    field: "purchaseId",
    parse: parsePositiveInteger,
    message: PURCHASE_ID_MESSAGE,
  },
  {
    query: "lot_number",
    field: "lotNumber",
    parse: parseLotNumber,
    message: LOT_NUMBER_MESSAGE,
  },
  {
    query: "status",
    field: "status",
    parse: parseStatus,
    message: STATUS_MESSAGE,
  },
  {
    query: "expiring_before",
    field: "expiringBefore",
    parse: parseExpiringBefore,
    message: EXPIRING_BEFORE_MESSAGE,
  },
]);

/**
 * Resolves and validates every listing filter. Malformed values answer 422.
 * @param {object} query - Express query object.
 * @returns {{ filters: object }|{ errors: Record<string, string> }} The
 *   filters or the validation errors.
 */
function resolveListQuery(query) {
  return resolveQueryFilters(query, QUERY_FILTERS);
}

module.exports = { QUERY_FILTERS, resolveListQuery };
