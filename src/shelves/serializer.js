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
 * Builds the public representation of a section with no audit columns.
 * @param {object} section - Section instance or plain object.
 * @returns {{ id: number, shelf_id: number, code: string, name: string|null,
 *   description: string|null }} Public section data.
 */
function toPublicSection(section) {
  return {
    id: readField(section, "id"),
    shelf_id: readField(section, "shelf_id"),
    code: readField(section, "code"),
    name: readField(section, "name"),
    description: readField(section, "description"),
  };
}

/**
 * Builds the public representation of a shelf. The `sections` array is only
 * included when the caller loaded it, so list responses stay flat unless
 * `include=sections` is requested.
 * @param {object} shelf - Shelf instance or plain object.
 * @param {object} [options] - Serialization options.
 * @param {boolean} [options.includeSections] - Append the nested sections.
 * @returns {{ id: number, warehouse_id: number, code: string,
 *   name: string|null, description: string|null, sections?: object[] }}
 *   Public shelf data.
 */
function toPublicShelf(shelf, { includeSections = false } = {}) {
  const publicShelf = {
    id: readField(shelf, "id"),
    warehouse_id: readField(shelf, "warehouse_id"),
    code: readField(shelf, "code"),
    name: readField(shelf, "name"),
    description: readField(shelf, "description"),
  };

  if (includeSections) {
    const sections = readField(shelf, "sections") ?? [];

    publicShelf.sections = sections.map((section) => toPublicSection(section));
  }

  return publicShelf;
}

module.exports = { toPublicSection, toPublicShelf };
