const yup = require("yup");
const { CODE_PATTERN } = require("./constants");

const CODE_MESSAGE = "code must match ^[a-z][a-z0-9_]{1,19}$";
const NAME_MESSAGE = "name is required";
const NAME_MAX_MESSAGE = "name must have at most 100 characters";
const DESCRIPTION_MESSAGE = "description must have at most 255 characters";
const SORT_ORDER_MESSAGE = "sort_order must be an integer >= 0";
const NEXT_STATUS_CODE_MESSAGE = "Invalid next status code";

/**
 * Builds the nullable destination code schema.
 * @returns {import("yup").StringSchema} The destination schema.
 */
function nextStatusCodeField() {
  return yup
    .string()
    .transform((value) => {
      if (value === null || value === undefined) {
        return value;
      }

      return typeof value === "string" ? value.trim() : value;
    })
    .typeError(NEXT_STATUS_CODE_MESSAGE)
    .matches(CODE_PATTERN, NEXT_STATUS_CODE_MESSAGE)
    .nullable();
}

/**
 * Builds the required `sort_order` schema.
 * @returns {import("yup").NumberSchema} The sort order schema.
 */
function sortOrderField() {
  return yup
    .number()
    .transform((value) => (value === null ? NaN : value))
    .typeError(SORT_ORDER_MESSAGE)
    .integer(SORT_ORDER_MESSAGE)
    .min(0, SORT_ORDER_MESSAGE)
    .required(SORT_ORDER_MESSAGE);
}

const createOrderStatusSchema = yup.object({
  code: yup
    .string()
    .transform((value) => (typeof value === "string" ? value.trim() : value))
    .typeError(CODE_MESSAGE)
    .matches(CODE_PATTERN, CODE_MESSAGE)
    .required(CODE_MESSAGE),
  name: yup
    .string()
    .transform((value) => (typeof value === "string" ? value.trim() : value))
    .typeError(NAME_MESSAGE)
    .min(1, NAME_MESSAGE)
    .max(100, NAME_MAX_MESSAGE)
    .required(NAME_MESSAGE),
  description: yup
    .string()
    .transform((value) => {
      if (value === null || value === undefined) {
        return null;
      }

      if (typeof value !== "string") {
        return value;
      }

      const trimmed = value.trim();

      return trimmed === "" ? null : trimmed;
    })
    .typeError(DESCRIPTION_MESSAGE)
    .max(255, DESCRIPTION_MESSAGE)
    .nullable(),
  sort_order: sortOrderField(),
  next_status_code: nextStatusCodeField(),
});

const updateOrderStatusSchema = yup.object({
  name: yup
    .string()
    .transform((value) => (typeof value === "string" ? value.trim() : value))
    .typeError(NAME_MESSAGE)
    .min(1, NAME_MESSAGE)
    .max(100, NAME_MAX_MESSAGE),
  description: yup
    .string()
    .transform((value) => {
      if (value === null || value === undefined) {
        return null;
      }

      if (typeof value !== "string") {
        return value;
      }

      const trimmed = value.trim();

      return trimmed === "" ? null : trimmed;
    })
    .typeError(DESCRIPTION_MESSAGE)
    .max(255, DESCRIPTION_MESSAGE)
    .nullable(),
  sort_order: sortOrderField().notRequired(),
  next_status_code: nextStatusCodeField(),
});

module.exports = {
  CODE_MESSAGE,
  DESCRIPTION_MESSAGE,
  NAME_MAX_MESSAGE,
  NAME_MESSAGE,
  NEXT_STATUS_CODE_MESSAGE,
  SORT_ORDER_MESSAGE,
  createOrderStatusSchema,
  updateOrderStatusSchema,
};
