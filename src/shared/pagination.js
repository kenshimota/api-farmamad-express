const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

/**
 * Parses a positive integer page number. Repeated or nested query parameters
 * (arrays and objects) are rejected so the API answers 422 instead of 500.
 * @param {unknown} value - Raw query value.
 * @returns {number|null} The page or null when invalid.
 */
function parsePage(value) {
  if (typeof value !== "string" && typeof value !== "number") {
    return null;
  }

  const text = String(value).trim();

  if (!/^\d+$/.test(text)) {
    return null;
  }

  const parsed = Number(text);

  return parsed >= 1 ? parsed : null;
}

/**
 * Parses a page size between 1 and 100.
 * @param {unknown} value - Raw query value.
 * @returns {number|null} The page size or null when invalid.
 */
function parsePageSize(value) {
  const parsed = parsePage(value);

  if (parsed === null || parsed > MAX_PAGE_SIZE) {
    return null;
  }

  return parsed;
}

/**
 * Builds the pagination metadata envelope.
 * @param {object} input - Pagination values.
 * @param {number} input.page - Requested page.
 * @param {number} input.pageSize - Requested page size.
 * @param {number} input.total - Total rows matching the filters.
 * @returns {{ page: number, page_size: number, total: number,
 *   total_pages: number, has_next: boolean, has_prev: boolean }} Meta.
 */
function buildMeta({ page, pageSize, total }) {
  const totalPages = total === 0 ? 0 : Math.ceil(total / pageSize);

  return {
    page,
    page_size: pageSize,
    total,
    total_pages: totalPages,
    has_next: page < totalPages,
    has_prev: page > 1,
  };
}

/**
 * Wraps the mapped rows in the `{ data, meta }` envelope.
 * @param {object[]} rows - Page rows.
 * @param {object} values - Pagination values.
 * @param {number} values.page - Requested page.
 * @param {number} values.pageSize - Requested page size.
 * @param {number} values.total - Total rows matching the filters.
 * @param {(row: object) => object} [serialize] - Row serializer.
 * @returns {{ data: object[], meta: object }} The paginated response.
 */
function buildPaginatedResponse(
  rows,
  { page, pageSize, total },
  serialize = (row) => row,
) {
  return {
    data: rows.map(serialize),
    meta: buildMeta({ page, pageSize, total }),
  };
}

/**
 * Sends a listing response preserving the backwards-compatible contract: a
 * flat array when the repository returned rows without pagination, or the
 * `{ data, meta }` envelope when it returned a page.
 * @param {object} res - Express response.
 * @param {object[]|{rows: object[], meta: object}} result - Listing result.
 * @param {(row: object) => object} [serialize] - Row serializer.
 * @returns {object} The Express response.
 */
function sendListResponse(res, result, serialize = (row) => row) {
  if (Array.isArray(result)) {
    return res.json(result.map(serialize));
  }

  return res.json({
    data: result.rows.map(serialize),
    meta: result.meta,
  });
}

/**
 * Runs the listing query. Without pagination it delegates to `findAll` and
 * never executes a `COUNT`; with pagination it runs a bounded
 * `findAndCountAll` using the same options.
 * @param {object} model - Sequelize model with `findAll`/`findAndCountAll`.
 * @param {object} options - Sequelize query options.
 * @param {object} pagination - Parsed pagination.
 * @param {boolean} pagination.enabled - Whether pagination was requested.
 * @param {number} [pagination.page] - Requested page.
 * @param {number} [pagination.pageSize] - Requested page size.
 * @returns {Promise<object[]|{ rows: object[], meta: object }>} Flat rows or
 *   the page with its metadata.
 */
async function findPage(model, options, pagination) {
  if (!pagination || pagination.enabled !== true) {
    return model.findAll(options);
  }

  const { page, pageSize } = pagination;
  const { rows, count } = await model.findAndCountAll({
    ...options,
    limit: pageSize,
    offset: (page - 1) * pageSize,
    distinct: true,
  });

  return { rows, meta: buildMeta({ page, pageSize, total: count }) };
}

module.exports = {
  DEFAULT_PAGE,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  buildMeta,
  buildPaginatedResponse,
  findPage,
  parsePage,
  parsePageSize,
  sendListResponse,
};
