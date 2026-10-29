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
 * Builds the public representation of a lot: the stored columns, the calculated
 * `available` and the five nested relations with the documented fields only.
 * @param {object} lot - Lot instance or plain object.
 * @returns {object} Public lot data.
 */
function toPublicLot(lot) {
  const stock = Number(readField(lot, "stock") ?? 0);
  const reserved = Number(readField(lot, "reserved") ?? 0);
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
    available: stock - reserved,
    warehouse_id: readField(lot, "warehouse_id"),
    shelf_id: readField(lot, "shelf_id"),
    section_id: readField(lot, "section_id"),
    ...relations,
  };
}

module.exports = { readField, toPublicLot, toPublicRelation };
