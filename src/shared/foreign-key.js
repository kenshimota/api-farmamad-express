/**
 * Reads the foreign key field named by a Sequelize constraint error. The field
 * can come as an object, an array or only inside the driver message; only the
 * `fields` accepted by the caller are returned.
 * @param {import("sequelize").ForeignKeyConstraintError} error - Sequelize
 *   constraint error.
 * @param {ReadonlyArray<string>} fields - Field names accepted by the module.
 * @returns {string|null} The matching field name or null.
 */
function foreignKeyField(error, fields) {
  const rawFields = error.fields;
  const candidates = Array.isArray(rawFields)
    ? rawFields
    : Object.keys(rawFields ?? {});
  const direct = candidates.find((field) => fields.includes(field));

  if (direct) {
    return direct;
  }

  const message = `${error.message ?? ""} ${
    error.parent?.detail ?? ""
  }`.toLowerCase();

  return fields.find((field) => message.includes(field)) ?? null;
}

module.exports = { foreignKeyField };
