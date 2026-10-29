const { Op } = require("sequelize");

const LOT_MODEL_PATH = "../models/lot";
const SHELF_COLUMNS = Object.freeze(["shelf_id", "shelfId"]);
const SECTION_COLUMNS = Object.freeze([
  "shelf_section_id",
  "section_id",
  "shelfSectionId",
  "sectionId",
]);

/**
 * Loads the Lot model when HU-24 is already present. The shelves module must
 * work before the lots table exists, so a missing module resolves to null
 * instead of crashing the API; any other loading error is propagated.
 * @returns {object|null} The Lot model or null when it does not exist yet.
 */
function loadLotModel() {
  try {
    return require(LOT_MODEL_PATH);
  } catch (error) {
    if (
      error &&
      error.code === "MODULE_NOT_FOUND" &&
      typeof error.message === "string" &&
      error.message.includes("models/lot")
    ) {
      return null;
    }

    throw error;
  }
}

/**
 * Reads the attributes declared by a Sequelize model.
 * @param {object} model - Sequelize model.
 * @returns {object} The attribute map.
 */
function attributesOf(model) {
  return typeof model.getAttributes === "function" ? model.getAttributes() : {};
}

/**
 * Keeps the candidate columns that the Lot model actually declares. This makes
 * the check tolerant to the exact column names chosen by HU-24.
 * @param {object} model - Lot model.
 * @param {string[]} candidates - Possible column names.
 * @returns {string[]} The declared column names.
 */
function pickColumns(model, candidates) {
  const attributes = attributesOf(model);

  return candidates.filter((column) =>
    Object.prototype.hasOwnProperty.call(attributes, column),
  );
}

/**
 * Counts the lots that match any of the candidate columns. Returning zero
 * without querying when there are no usable columns keeps the check safe while
 * HU-24 has not defined its foreign keys yet.
 * @param {object} model - Lot model.
 * @param {string[]} columns - Declared candidate columns.
 * @param {(column: string) => object} buildCondition - Condition for a column.
 * @returns {Promise<number>} The matching rows.
 */
function countMatching(model, columns, buildCondition) {
  if (!columns.length) {
    return Promise.resolve(0);
  }

  return model.count({
    where: { [Op.or]: columns.map((column) => buildCondition(column)) },
  });
}

/**
 * Counts the lots where at least one of the columns matches the value.
 * @param {object} model - Lot model.
 * @param {string[]} columns - Declared candidate columns.
 * @param {unknown} value - Value compared with equality.
 * @returns {Promise<number>} The matching rows.
 */
function countEquals(model, columns, value) {
  return countMatching(model, columns, (column) => ({ [column]: value }));
}

/**
 * Counts the lots where at least one of the columns belongs to the values.
 * @param {object} model - Lot model.
 * @param {string[]} columns - Declared candidate columns.
 * @param {unknown[]} values - Values compared with `IN`.
 * @returns {Promise<number>} The matching rows.
 */
function countIn(model, columns, values) {
  if (!values.length) {
    return Promise.resolve(0);
  }

  return countMatching(model, columns, (column) => ({
    [column]: { [Op.in]: values },
  }));
}

/**
 * Counts the lots that reference a shelf directly or through one of its
 * sections. Returns 0 when HU-24 has not added the Lot model yet.
 * @param {number} shelfId - Shelf id.
 * @param {number[]} [sectionIds] - Sections that belong to the shelf.
 * @returns {Promise<number>} The number of associated lots.
 */
async function countShelfLots(shelfId, sectionIds = []) {
  const model = loadLotModel();

  if (!model) {
    return 0;
  }

  const direct = await countEquals(
    model,
    pickColumns(model, SHELF_COLUMNS),
    shelfId,
  );
  const nested = await countIn(
    model,
    pickColumns(model, SECTION_COLUMNS),
    sectionIds,
  );

  return direct + nested;
}

/**
 * Counts the lots that reference one section. Returns 0 when HU-24 has not
 * added the Lot model yet.
 * @param {number} sectionId - Section id.
 * @returns {Promise<number>} The number of associated lots.
 */
function countSectionLots(sectionId) {
  const model = loadLotModel();

  if (!model) {
    return Promise.resolve(0);
  }

  return countEquals(model, pickColumns(model, SECTION_COLUMNS), sectionId);
}

module.exports = {
  SECTION_COLUMNS,
  SHELF_COLUMNS,
  countSectionLots,
  countShelfLots,
  loadLotModel,
};
