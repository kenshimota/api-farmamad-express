/**
 * Single source of truth for the nested relations of a lot: the alias, the
 * fields exposed by the API and, therefore, the attributes loaded by Sequelize.
 * The repository and the serializer both consume this table so they cannot
 * drift apart.
 * @type {ReadonlyArray<{ as: string, fields: ReadonlyArray<string> }>}
 */
const RELATION_FIELDS = Object.freeze([
  { as: "product", fields: Object.freeze(["id", "name", "reference"]) },
  {
    as: "item_state",
    fields: Object.freeze(["id", "name", "label", "is_sellable"]),
  },
  { as: "warehouse", fields: Object.freeze(["id", "name"]) },
  { as: "shelf", fields: Object.freeze(["id", "code", "name"]) },
  { as: "section", fields: Object.freeze(["id", "code", "name"]) },
]);

/**
 * Builds the `include` options of Sequelize from the relation table.
 * @param {Record<string, object>} models - Model per relation alias.
 * @returns {object[]} The `include` options.
 */
function buildIncludes(models) {
  return RELATION_FIELDS.map(({ as, fields }) => ({
    model: models[as],
    as,
    attributes: [...fields],
  }));
}

module.exports = { RELATION_FIELDS, buildIncludes };
