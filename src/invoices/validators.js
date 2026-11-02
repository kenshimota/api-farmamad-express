const yup = require("yup");

const REQUIRED_INVOICE_FIELDS = Object.freeze([
  "customer_id",
  "invoiced_by_user_id",
  "currency_id",
  "subtotal",
  "total",
]);
const REQUIRED_INVOICE_ITEM_FIELDS = Object.freeze([
  "product_id",
  "product_name",
  "product_reference",
  "item_state_id",
  "item_state_name",
  "quantity",
  "unit_price",
]);
const PAYMENT_STATUSES = Object.freeze(["pending", "partial", "paid"]);
const MAX_NOTES_LENGTH = 1000;
const MAX_MONEY = 9999999999.99;
const MAX_QUANTITY = 1000000;

/**
 * Builds a positive integer schema.
 * @param {string} message - Error message.
 * @param {boolean} [required] - Whether the value is mandatory.
 * @returns {import("yup").NumberSchema} The schema.
 */
function positiveInteger(message, required = true) {
  const schema = yup
    .number()
    .transform((value) => (value === null ? NaN : value))
    .typeError(message)
    .integer(message)
    .min(1, message);

  return required ? schema.required(message) : schema;
}

/**
 * Builds a non-negative decimal amount with at most two decimals.
 * @param {string} message - Type error message.
 * @param {boolean} [required] - Whether the value is mandatory.
 * @returns {import("yup").NumberSchema} The schema.
 */
function money(message, required = true) {
  const schema = yup
    .number()
    .transform((value, originalValue) => {
      if (originalValue === null) {
        return NaN;
      }

      if (typeof originalValue === "string" && originalValue.trim() === "") {
        return NaN;
      }

      return value;
    })
    .typeError(message)
    .min(0, message)
    .max(MAX_MONEY, message)
    .test("max-decimals", message, (value) =>
      value === undefined ? true : Number.isInteger(value * 100),
    );

  return required ? schema.required(message) : schema;
}

/**
 * Builds a required short text field.
 * @param {number} max - Maximum length.
 * @param {string} message - Error message.
 * @returns {import("yup").StringSchema} The schema.
 */
function shortText(max, message) {
  return yup
    .string()
    .trim()
    .typeError(message)
    .max(max, message)
    .required(message);
}

/**
 * Builds the optional notes schema. Blank strings become null.
 * @returns {import("yup").StringSchema} The notes schema.
 */
function notesField() {
  return yup
    .string()
    .transform((value) => {
      if (value === null) {
        return null;
      }

      if (typeof value !== "string") {
        return value;
      }

      const trimmed = value.trim();

      return trimmed === "" ? null : trimmed;
    })
    .typeError("notes must have at most 1000 characters")
    .test(
      "is-string",
      "notes must have at most 1000 characters",
      function isString(value) {
        return value == null || typeof this.originalValue === "string";
      },
    )
    .max(MAX_NOTES_LENGTH, "notes must have at most 1000 characters")
    .nullable();
}

const createInvoiceItemSchema = yup.object({
  order_item_id: positiveInteger("Invalid order item id", false).nullable(),
  product_id: positiveInteger("Invalid product id"),
  product_name: shortText(150, "Invalid product name"),
  product_reference: shortText(100, "Invalid product reference"),
  item_state_id: positiveInteger("Invalid item state id"),
  item_state_name: shortText(50, "Invalid item state name"),
  quantity: yup
    .number()
    .transform((value) => (value === null ? NaN : value))
    .typeError("quantity must be an integer")
    .integer("quantity must be an integer")
    .min(1, "quantity must be > 0")
    .max(MAX_QUANTITY, "quantity must be <= 1000000")
    .required("quantity must be an integer"),
  unit_price: money("unit_price must be a number"),
  subtotal: money("subtotal must be a number"),
});

const createInvoiceSchema = yup.object({
  order_id: positiveInteger("Invalid order id", false).nullable(),
  customer_id: positiveInteger("Invalid customer id"),
  invoiced_by_user_id: positiveInteger("Invalid user id"),
  currency_id: positiveInteger("Invalid currency id"),
  payment_term_id: positiveInteger("Invalid payment term id", false).nullable(),
  payment_term_days: yup
    .number()
    .transform((value) => (value === null ? NaN : value))
    .typeError("payment_term_days must be an integer")
    .integer("payment_term_days must be an integer")
    .min(0, "payment_term_days must be >= 0")
    .max(3650, "payment_term_days must be <= 3650"),
  subtotal: money("subtotal must be a number"),
  tax_amount: money("tax_amount must be a number").default(0),
  total: money("total must be a number"),
  paid_amount: money("paid_amount must be a number").default(0),
  payment_status: yup
    .string()
    .oneOf([...PAYMENT_STATUSES], "Invalid payment status")
    .default("pending"),
  issued_at: yup.date().typeError("Invalid issued_at"),
  due_date: yup
    .string()
    .matches(/^\d{4}-\d{2}-\d{2}$/, "Invalid due_date")
    .nullable(),
  notes: notesField(),
  items: yup.array().of(createInvoiceItemSchema).default([]),
});

module.exports = {
  MAX_MONEY,
  MAX_NOTES_LENGTH,
  MAX_QUANTITY,
  PAYMENT_STATUSES,
  REQUIRED_INVOICE_FIELDS,
  REQUIRED_INVOICE_ITEM_FIELDS,
  createInvoiceItemSchema,
  createInvoiceSchema,
};
