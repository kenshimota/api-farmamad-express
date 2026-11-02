const {
  CURRENCY_FILTER_MESSAGE,
  ITEM_STATE_FILTER_MESSAGE,
  PRODUCT_FILTER_MESSAGE,
  parseCurrencyId,
  parseItemStateId,
  parseProductId,
} = require("./validators");
const { parseDateOnly, parseListQuery } = require("../shared/list-query");
const { SORT_FIELDS } = require("./repository");

const FILTER_SPECS = Object.freeze([
  {
    query: "product_id",
    field: "productId",
    parse: parseProductId,
    message: PRODUCT_FILTER_MESSAGE,
  },
  {
    query: "item_state_id",
    field: "itemStateId",
    parse: parseItemStateId,
    message: ITEM_STATE_FILTER_MESSAGE,
  },
  {
    query: "currency_id",
    field: "currencyId",
    parse: parseCurrencyId,
    message: CURRENCY_FILTER_MESSAGE,
  },
  {
    query: "from",
    field: "from",
    parse: parseDateOnly,
    message: "Invalid from",
  },
  {
    query: "to",
    field: "to",
    parse: parseDateOnly,
    message: "Invalid to",
  },
]);

/**
 * Parses the optional filters, sort and pagination of the cost listing.
 * @param {object} query - Express query object.
 * @returns {{ query: object }|{ error: { status: number, body: object } }}
 *   The parsed query or the HTTP error to answer.
 */
function resolveFilters(query) {
  const parsed = parseListQuery(query, {
    filters: FILTER_SPECS,
    sortFields: SORT_FIELDS,
    defaultOrder: [
      ["product_id", "ASC"],
      ["item_state_id", "ASC"],
    ],
  });

  if (parsed.errors) {
    return { error: { status: 422, body: { errors: parsed.errors } } };
  }

  return { query: parsed };
}

module.exports = { FILTER_SPECS, resolveFilters };
