const { Op } = require("sequelize");

const SEARCHABLE_FIELDS = Object.freeze(["name", "identification"]);

/**
 * Trims an optional search term. Omitted, blank and non-string values (which
 * can appear for repeated or nested query parameters) become null so the
 * caller falls back to the full listing and never answers 500.
 * @param {unknown} value - Raw `req.query.q` value.
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
 * name and identification. A single OR condition keeps the result free of
 * duplicates when a supplier matches in more than one field.
 * @param {string} term - Already trimmed search term.
 * @returns {object} Sequelize `where` fragment.
 */
function buildSearchFilter(term) {
  const pattern = `%${term}%`;

  return {
    [Op.or]: SEARCHABLE_FIELDS.map((field) => ({
      [field]: { [Op.iLike]: pattern },
    })),
  };
}

/**
 * Search strategy used by the supplier repository. Hiding the term
 * normalization and the Sequelize filter behind the same object keeps the
 * query construction in one place.
 */
const supplierSearch = Object.freeze({
  normalize: normalizeTerm,
  buildFilter: buildSearchFilter,
});

module.exports = {
  SEARCHABLE_FIELDS,
  buildSearchFilter,
  normalizeTerm,
  supplierSearch,
};
