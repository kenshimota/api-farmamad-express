const yup = require("yup");

const REQUIRED_PRICE_LIST_FIELDS = Object.freeze(["name", "percentage"]);
const POSITIVE_INTEGER_PATTERN = /^\d+$/;

const NAME_MESSAGE = "Nombre inválido";
const DESCRIPTION_MESSAGE = "Descripción inválida";
const PERCENTAGE_MESSAGE = "Invalid percentage";
const PERCENTAGE_RANGE_MESSAGE = "percentage must be < 100";
const MAX_NAME_LENGTH = 150;
const MAX_DESCRIPTION_LENGTH = 500;

/**
 * Tells whether a numeric value has at most two decimal places, allowing for
 * the usual binary floating point representation error.
 * @param {number} value - Numeric value already cast by yup.
 * @returns {boolean} True when the value fits DECIMAL(5,2) decimals.
 */
function hasAtMostTwoDecimals(value) {
  if (!Number.isFinite(value)) {
    return false;
  }

  const scaled = value * 100;
  const tolerance = Number.EPSILON * Math.abs(scaled) * 4;

  return Math.abs(scaled - Math.round(scaled)) <= tolerance;
}

/**
 * Builds the required trimmed name schema.
 * @returns {import("yup").StringSchema} The name schema.
 */
function nameField() {
  return yup
    .string()
    .transform((value) => (typeof value === "string" ? value.trim() : value))
    .typeError(NAME_MESSAGE)
    .matches(/\S/, NAME_MESSAGE)
    .max(MAX_NAME_LENGTH, NAME_MESSAGE)
    .required(NAME_MESSAGE);
}

/**
 * Builds the optional description schema. Text is trimmed, blank values become
 * `null` and a missing value stays undefined for the caller to decide the
 * default.
 * @returns {import("yup").StringSchema} The description schema.
 */
function descriptionField() {
  return yup
    .string()
    .transform((value) => {
      if (typeof value !== "string") {
        return value;
      }

      const trimmed = value.trim();

      return trimmed === "" ? null : trimmed;
    })
    .nullable()
    .typeError(DESCRIPTION_MESSAGE)
    .max(MAX_DESCRIPTION_LENGTH, DESCRIPTION_MESSAGE);
}

/**
 * Builds the required percentage schema. The value must be a finite number in
 * the `[0, 100)` range with at most two decimals.
 * @returns {import("yup").NumberSchema} The percentage schema.
 */
function percentageField() {
  return yup
    .number()
    .transform((value, originalValue) => {
      if (originalValue === null || originalValue === undefined) {
        return originalValue;
      }

      if (typeof originalValue === "string" && originalValue.trim() === "") {
        return NaN;
      }

      return value;
    })
    .typeError(PERCENTAGE_MESSAGE)
    .min(0, PERCENTAGE_MESSAGE)
    .lessThan(100, PERCENTAGE_RANGE_MESSAGE)
    .test("max-decimals", PERCENTAGE_MESSAGE, (value) =>
      value === undefined || value === null
        ? true
        : hasAtMostTwoDecimals(value),
    )
    .required(PERCENTAGE_MESSAGE);
}

const createPriceListSchema = yup.object({
  name: nameField(),
  description: descriptionField(),
  percentage: percentageField(),
});

const updatePriceListSchema = createPriceListSchema;

/**
 * Parses a positive integer identifier coming from a route parameter.
 * @param {unknown} value - Raw route parameter.
 * @returns {number|null} The positive integer id or null when invalid.
 */
function parsePriceListId(value) {
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
  DESCRIPTION_MESSAGE,
  MAX_DESCRIPTION_LENGTH,
  MAX_NAME_LENGTH,
  NAME_MESSAGE,
  PERCENTAGE_MESSAGE,
  PERCENTAGE_RANGE_MESSAGE,
  REQUIRED_PRICE_LIST_FIELDS,
  createPriceListSchema,
  parsePriceListId,
  updatePriceListSchema,
};
