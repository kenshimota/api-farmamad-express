const { RELATION_FIELDS } = require("./relations");

/**
 * Reads a field from a Sequelize instance or a plain object.
 * @param {object} record - Sequelize instance or plain object.
 * @param {string} field - Field name.
 * @returns {unknown} The raw value.
 */
function readField(record, field) {
  return typeof record.get === "function" ? record.get(field) : record[field];
}

/**
 * Serializes an assignment timestamp as an ISO string, keeping an already
 * stringified value untouched.
 * @param {unknown} value - Date, string or null.
 * @returns {string|null} The timestamp.
 */
function toAssignedAt(value) {
  if (!value) {
    return null;
  }

  return value instanceof Date ? value.toISOString() : value;
}

/**
 * Maps an included relation to the documented shape, dropping audit columns
 * and any fields the client must not see.
 * @param {object|null} record - Included instance or plain object.
 * @param {string[]} fields - Fields to expose in order.
 * @returns {object|null} The public relation or null when it is absent.
 */
function toPublicRelation(record, fields) {
  if (!record) {
    return null;
  }

  return fields.reduce((publicRecord, field) => {
    publicRecord[field] = readField(record, field);
    return publicRecord;
  }, {});
}

/**
 * Builds the public representation of an assignment: its identifiers, the
 * server-managed `assigned_at` and the nested customer and seller with the
 * documented fields only.
 * @param {object} assignment - Assignment instance or plain object.
 * @returns {object} Public assignment data.
 */
function toPublicCustomerSeller(assignment) {
  const relations = RELATION_FIELDS.reduce(
    (publicRelations, { as, fields }) => {
      publicRelations[as] = toPublicRelation(readField(assignment, as), fields);
      return publicRelations;
    },
    {},
  );

  return {
    id: readField(assignment, "id"),
    customer_id: readField(assignment, "customer_id"),
    seller_id: readField(assignment, "seller_id"),
    assigned_at: toAssignedAt(readField(assignment, "assigned_at")),
    ...relations,
  };
}

module.exports = {
  readField,
  toAssignedAt,
  toPublicCustomerSeller,
  toPublicRelation,
};
