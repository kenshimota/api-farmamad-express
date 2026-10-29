/**
 * Single source of truth for the nested relations of a customer-seller
 * assignment: the alias, the fields exposed by the API and, therefore, the
 * attributes loaded by Sequelize. The repository and the serializer consume
 * this table so they cannot drift apart.
 * @type {ReadonlyArray<{ as: string, fields: ReadonlyArray<string> }>}
 */
const RELATION_FIELDS = Object.freeze([
  {
    as: "customer",
    fields: Object.freeze(["id", "fullName", "email", "direction"]),
  },
  {
    as: "seller",
    fields: Object.freeze(["id", "username", "email", "name"]),
  },
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
