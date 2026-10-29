const { Op } = require("sequelize");

const SEARCHABLE_FIELDS = Object.freeze(["name", "observations", "address"]);

/**
 * Trims an optional search term. Omitted, blank and non-string values (which
 * can appear for repeated or nested query parameters) become null so the
 * caller falls back to the full listing and never answers 500.
 * @param {unknown} value - Raw `req.query.search` value.
 * @returns {string|null} The trimmed term or null when there is no search.
 */
function normalizeTerm(value) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();

  return trimmed === "" ? null : trimmed;
}

/**
 * Builds the Sequelize filter for a partial, case-insensitive search over the
 * three text fields. A single OR condition keeps the result free of
 * duplicates when a warehouse matches in more than one field.
 * @param {string} term - Already trimmed search term.
 * @returns {object} Sequelize `where` object.
 */
function buildPartialFilter(term) {
  const pattern = `%${term}%`;

  return {
    [Op.or]: SEARCHABLE_FIELDS.map((field) => ({
      [field]: { [Op.iLike]: pattern },
    })),
  };
}

/**
 * Search strategy used by the warehouse repository. Hiding the term
 * normalization and the Sequelize filter behind the same object keeps the
 * query construction in one place and lets the repository depend on the
 * strategy instead of the search details.
 */
const warehouseSearch = Object.freeze({
  normalize: normalizeTerm,
  buildFilter: buildPartialFilter,
});

module.exports = {
  SEARCHABLE_FIELDS,
  buildPartialFilter,
  normalizeTerm,
  warehouseSearch,
};
