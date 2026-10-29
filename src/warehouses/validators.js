const yup = require("yup");

const REQUIRED_WAREHOUSE_FIELDS = ["name", "address"];
const POSITIVE_INTEGER_PATTERN = /^\d+$/;

/**
 * Builds a trimmed string schema that rejects blank values and non-string
 * values without crashing on the trim transform.
 * @param {string} message - Error message for invalid values.
 * @returns {import("yup").StringSchema} The string schema.
 */
function trimmedString(message) {
  return yup
    .string()
    .transform((value) => (typeof value === "string" ? value.trim() : value))
    .typeError(message)
    .matches(/\S/, message);
}

/**
 * Builds the optional observations schema. Null and omitted values are
 * accepted; strings are trimmed and any other type is rejected.
 * @returns {import("yup").StringSchema} The observations schema.
 */
function observationsField() {
  return yup
    .string()
    .transform((value) => (typeof value === "string" ? value.trim() : value))
    .typeError("Observaciones inválidas")
    .nullable();
}

const createWarehouseSchema = yup.object({
  name: trimmedString("Nombre inválido"),
  address: trimmedString("Dirección inválida"),
  observations: observationsField().default(null),
});

const updateWarehouseSchema = yup.object({
  name: trimmedString("Nombre inválido"),
  address: trimmedString("Dirección inválida"),
  observations: observationsField(),
});

/**
 * Parses a warehouse id coming from a route parameter. Only positive integers
 * are accepted; anything else (decimals, negatives, non numeric values) is
 * reported as null so the caller can answer 422.
 * @param {unknown} value - Raw route parameter.
 * @returns {number|null} The positive integer id or null when invalid.
 */
function parseWarehouseId(value) {
  if (typeof value === "number") {
    return Number.isInteger(value) && value >= 1 ? value : null;
  }

  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();

  if (!POSITIVE_INTEGER_PATTERN.test(trimmed)) {
    return null;
  }

  const parsed = Number(trimmed);

  return parsed >= 1 ? parsed : null;
}

module.exports = {
  createWarehouseSchema,
  updateWarehouseSchema,
  parseWarehouseId,
  REQUIRED_WAREHOUSE_FIELDS,
};
