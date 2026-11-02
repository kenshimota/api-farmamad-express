const { Op, Sequelize } = require("sequelize");

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Parses a strict `YYYY-MM-DD` calendar date.
 * @param {unknown} value - Raw query value.
 * @returns {string|null} The date or null when invalid.
 */
function parseDateOnly(value) {
  if (typeof value !== "string") {
    return null;
  }

  const text = value.trim();

  if (!DATE_ONLY_PATTERN.test(text)) {
    return null;
  }

  const [year, month, day] = text.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return text;
}

/**
 * Parses a required, non-blank text filter, trimming the surrounding spaces.
 * Used by filters that only accept a meaningful string such as `reference`,
 * `role` or `status`.
 * @param {unknown} value - Raw query value.
 * @returns {string|null} The trimmed text or null when invalid.
 */
function parseNonEmptyString(value) {
  if (typeof value !== "string") {
    return null;
  }

  const text = value.trim();

  return text === "" ? null : text;
}

/**
 * Builds an inclusive range over a timestamp or DATEONLY column. `from` starts
 * at 00:00:00 and `to` ends at 23:59:59.999.
 * @param {string} field - Column name.
 * @param {string|null} from - Inclusive lower date.
 * @param {string|null} to - Inclusive upper date.
 * @param {object} [options] - Range options.
 * @param {boolean} [options.dateOnly] - Use plain `YYYY-MM-DD` values.
 * @returns {object|null} The Sequelize condition or null when empty.
 */
function buildDayRange(field, from, to, { dateOnly = false } = {}) {
  const condition = {};

  if (from) {
    condition[Op.gte] = dateOnly ? from : new Date(`${from}T00:00:00.000Z`);
  }

  if (to) {
    condition[Op.lte] = dateOnly ? to : new Date(`${to}T23:59:59.999Z`);
  }

  return from || to ? { [field]: condition } : null;
}

/**
 * Trims a search term. Non-string values are invalid and blank strings mean
 * "no filter".
 * @param {unknown} value - Raw term.
 * @returns {string|null|undefined} The term, undefined when blank, or null
 *   when the value is not a string.
 */
function normalizeSearchTerm(value) {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "string") {
    return null;
  }

  const term = value.trim();

  return term === "" ? undefined : term;
}

/**
 * Builds a partial, case-insensitive text search over the given fields.
 * @param {string|undefined} term - Already normalized term.
 * @param {string[]} fields - Searchable columns.
 * @returns {object|null} The Sequelize condition or null.
 */
function buildTextSearch(term, fields) {
  if (typeof term !== "string" || term.trim() === "") {
    return null;
  }

  const pattern = `%${term.trim()}%`;

  return {
    [Op.or]: fields.map((field) => ({ [field]: { [Op.iLike]: pattern } })),
  };
}

/**
 * Builds a partial search against numeric columns by casting them to text, so
 * invoices, orders and purchases can be autocompleted by number without raw
 * SQL interpolation.
 * @param {string|undefined} term - Already normalized term.
 * @param {string[]} fields - Numeric columns.
 * @returns {object|null} The Sequelize condition or null.
 */
function buildNumberSearch(term, fields) {
  if (typeof term !== "string" || term.trim() === "") {
    return null;
  }

  const pattern = `%${term.trim()}%`;

  return {
    [Op.or]: fields.map((field) =>
      Sequelize.where(Sequelize.cast(Sequelize.col(field), "varchar"), {
        [Op.iLike]: pattern,
      }),
    ),
  };
}

module.exports = {
  buildDayRange,
  buildNumberSearch,
  buildTextSearch,
  normalizeSearchTerm,
  parseDateOnly,
  parseNonEmptyString,
};
