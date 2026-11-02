const {
  DEFAULT_PAGE,
  DEFAULT_PAGE_SIZE,
  parsePage,
  parsePageSize,
} = require("./pagination");
const {
  buildDayRange,
  buildNumberSearch,
  buildTextSearch,
  normalizeSearchTerm,
  parseDateOnly,
  parseNonEmptyString,
} = require("./list-filters");
const { resolveQueryFilters } = require("./query-filters");

/**
 * Builds the stable order of a listing. When a sort is sent, `id` is appended
 * ascending to break ties; when pagination is enabled the default order also
 * ends with `id` ascending.
 * @param {object} input - Order options.
 * @param {string} [input.sort] - Whitelisted sort field.
 * @param {string} [input.direction] - `asc` or `desc`.
 * @param {Array<[string, string]>} [input.defaultOrder] - Module default.
 * @param {boolean} [input.paginated] - Whether pagination was requested.
 * @returns {Array<[string, string]>} Sequelize order clauses.
 */
function buildSortOrder({
  sort,
  direction = "asc",
  defaultOrder = [["id", "ASC"]],
  paginated = false,
}) {
  if (sort) {
    const column = direction.toLowerCase() === "desc" ? "DESC" : "ASC";

    return sort === "id"
      ? [["id", column]]
      : [
          [sort, column],
          ["id", "ASC"],
        ];
  }

  const order = defaultOrder.map(([field, column]) => [field, column]);

  if (!paginated) {
    return order;
  }

  const idIndex = order.findIndex(([field]) => field === "id");

  if (idIndex === -1) {
    order.push(["id", "ASC"]);
  } else {
    order[idIndex] = ["id", "ASC"];
  }

  return order;
}

/**
 * Tells whether the parsed query needs the listing options (`pagination` and
 * `order`) forwarded to the module service. A `sort` alone must still apply the
 * requested order even when pagination is not enabled.
 * @param {object} query - Result of `parseListQuery`.
 * @returns {boolean} True when the service must receive the listing options.
 */
function needsListOptions(query) {
  return query.pagination.enabled || query.sort !== undefined;
}

/**
 * Parses the pagination, ordering, search term and module filters of a list
 * endpoint. Any invalid parameter is returned in a single `errors` object so
 * the router can answer 422 keyed by parameter.
 * @param {object} [query] - Express query object.
 * @param {object} [config] - Endpoint configuration.
 * @param {Array<{query: string, field: string, parse: Function,
 *   message: string}>} [config.filters] - Filter definitions.
 * @param {string[]} [config.sortFields] - Whitelisted sort columns.
 * @param {Array<[string, string]>} [config.defaultOrder] - Default order.
 * @param {string} [config.qMessage] - Message for a malformed `q`.
 * @returns {object} `{ errors }` or the parsed query.
 */
function parseListQuery(query = {}, config = {}) {
  const {
    filters: definitions = [],
    sortFields = [],
    defaultOrder = [["id", "ASC"]],
    qMessage = "Invalid q",
  } = config;
  const errors = {};
  const filters = {};
  const paginated = query.page !== undefined || query.page_size !== undefined;
  let page = DEFAULT_PAGE;
  let pageSize = DEFAULT_PAGE_SIZE;

  if (query.page !== undefined) {
    const parsed = parsePage(query.page);

    if (parsed === null) {
      errors.page = "Invalid page";
    } else {
      page = parsed;
    }
  }

  if (query.page_size !== undefined) {
    const parsed = parsePageSize(query.page_size);

    if (parsed === null) {
      errors.page_size = "Invalid page_size";
    } else {
      pageSize = parsed;
    }
  }

  let sort;

  if (query.sort !== undefined) {
    if (
      typeof query.sort !== "string" ||
      !sortFields.includes(query.sort.trim())
    ) {
      errors.sort = "Invalid sort";
    } else {
      sort = query.sort.trim();
    }
  }

  let direction = "asc";

  if (query.order !== undefined) {
    const value =
      typeof query.order === "string" ? query.order.trim().toLowerCase() : null;

    if (value !== "asc" && value !== "desc") {
      errors.order = "Invalid order";
    } else {
      direction = value;
    }
  }

  const searchTerm = normalizeSearchTerm(query.q);

  if (searchTerm === null) {
    errors.q = qMessage;
  }

  const resolvedFilters = resolveQueryFilters(query, definitions);

  if (resolvedFilters.errors) {
    Object.assign(errors, resolvedFilters.errors);
  } else {
    Object.assign(filters, resolvedFilters.filters);
  }

  if (Object.keys(errors).length > 0) {
    return { errors };
  }

  return {
    pagination: { enabled: paginated, page, pageSize },
    sort,
    direction,
    order: buildSortOrder({ sort, direction, defaultOrder, paginated }),
    q: searchTerm,
    filters,
  };
}

module.exports = {
  buildDayRange,
  buildNumberSearch,
  buildSortOrder,
  buildTextSearch,
  needsListOptions,
  normalizeSearchTerm,
  parseDateOnly,
  parseListQuery,
  parseNonEmptyString,
};
