const yup = require("yup");

const REQUIRED_LOCATION_FIELDS = Object.freeze([
  "warehouse_id",
  "shelf_id",
  "section_id",
]);
const PRODUCT_ID_MESSAGE = "Invalid product id";
const PURCHASE_ID_MESSAGE = "Invalid purchase id";
const WAREHOUSE_ID_MESSAGE = "Invalid warehouse id";
const SHELF_ID_MESSAGE = "Invalid shelf id";
const SECTION_ID_MESSAGE = "Invalid section id";
const STATUS_MESSAGE = "Invalid status";
const LOT_NUMBER_MESSAGE = "Invalid lot number";
const EXPIRING_BEFORE_MESSAGE =
  "expiring_before must be a valid date (YYYY-MM-DD)";
const STATUSES = Object.freeze(["pending", "in_progress", "located", "all"]);

/**
 * Builds a required positive integer schema.
 * @param {string} message - Error message for invalid values.
 * @returns {import("yup").NumberSchema} The schema.
 */
function positiveInteger(message) {
  return yup
    .number()
    .transform((value) => (value === null ? NaN : value))
    .typeError(message)
    .integer(message)
    .min(1, message)
    .required(message);
}

const locationSchema = yup.object({
  warehouse_id: positiveInteger(WAREHOUSE_ID_MESSAGE),
  shelf_id: positiveInteger(SHELF_ID_MESSAGE),
  section_id: positiveInteger(SECTION_ID_MESSAGE),
});

module.exports = {
  EXPIRING_BEFORE_MESSAGE,
  LOT_NUMBER_MESSAGE,
  PRODUCT_ID_MESSAGE,
  PURCHASE_ID_MESSAGE,
  REQUIRED_LOCATION_FIELDS,
  SECTION_ID_MESSAGE,
  SHELF_ID_MESSAGE,
  STATUSES,
  STATUS_MESSAGE,
  WAREHOUSE_ID_MESSAGE,
  locationSchema,
};
