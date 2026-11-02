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
 * Serializes a timestamp as an ISO string, keeping null/undefined as null.
 * @param {unknown} value - Date, string or null.
 * @returns {string|null} The ISO timestamp or null.
 */
function toIsoOrNull(value) {
  if (!value) {
    return null;
  }

  return value instanceof Date ? value.toISOString() : value;
}

/**
 * Builds the public representation of a lot: the stored columns, the calculated
 * `available` and the five nested relations with the documented fields only.
 * Non-located lots report `available = 0` because their stock cannot be sold.
 * @param {object} lot - Lot instance or plain object.
 * @returns {object} Public lot data.
 */
function toPublicLot(lot) {
  const stock = Number(readField(lot, "stock") ?? 0);
  const reserved = Number(readField(lot, "reserved") ?? 0);
  const locationStatus = readField(lot, "location_status") ?? "located";
  const available = locationStatus === "located" ? stock - reserved : 0;
  const relations = RELATION_FIELDS.reduce(
    (publicRelations, { as, fields }) => {
      publicRelations[as] = toPublicRelation(readField(lot, as), fields);
      return publicRelations;
    },
    {},
  );

  return {
    id: readField(lot, "id"),
    number: readField(lot, "number"),
    product_id: readField(lot, "product_id"),
    expiration_date: readField(lot, "expiration_date"),
    item_state_id: readField(lot, "item_state_id"),
    stock,
    reserved,
    available,
    warehouse_id: readField(lot, "warehouse_id") ?? null,
    shelf_id: readField(lot, "shelf_id") ?? null,
    section_id: readField(lot, "section_id") ?? null,
    location_status: locationStatus,
    location_started_at: toIsoOrNull(readField(lot, "location_started_at")),
    located_at: toIsoOrNull(readField(lot, "located_at")),
    ...relations,
  };
}

module.exports = {
  readField,
  toIsoOrNull,
  toPublicLot,
  toPublicRelation,
};
