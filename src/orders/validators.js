const yup = require("yup");

const MAX_ITEMS = 50;
const MIN_QUANTITY = 1;
const MAX_QUANTITY = 999;
const MAX_DELIVERY_ADDRESS_LENGTH = 500;
const MAX_NOTES_LENGTH = 1000;

const ITEMS_ARRAY_MESSAGE = "items must be an array";
const ITEMS_MAX_MESSAGE = "items must contain at most 50 lines";
const PRODUCT_ID_MESSAGE = "Invalid product id";
const ITEM_STATE_ID_MESSAGE = "Invalid item state id";
const CUSTOMER_ID_MESSAGE = "Invalid customer id";
const QUANTITY_TYPE_MESSAGE = "quantity must be an integer";
const QUANTITY_MIN_MESSAGE = "quantity must be >= 1";
const QUANTITY_MAX_MESSAGE = "quantity must be <= 999";
const DELIVERY_ADDRESS_MESSAGE =
  "delivery_address must have between 1 and 500 characters";
const NOTES_MESSAGE = "notes must have at most 1000 characters";
const PAYMENT_TERM_ID_MESSAGE = "Invalid payment term";
const STATUS_MESSAGE = "Invalid status";

/**
 * Builds a required positive integer schema.
 * @param {string} message - Error message.
 * @returns {import("yup").NumberSchema} The identifier schema.
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

/**
 * Builds the quantity schema: an integer between 1 and 999.
 * @returns {import("yup").NumberSchema} The quantity schema.
 */
function quantityField() {
  return yup
    .number()
    .transform((value) => (value === null ? NaN : value))
    .typeError(QUANTITY_TYPE_MESSAGE)
    .integer(QUANTITY_TYPE_MESSAGE)
    .min(MIN_QUANTITY, QUANTITY_MIN_MESSAGE)
    .max(MAX_QUANTITY, QUANTITY_MAX_MESSAGE)
    .required(QUANTITY_TYPE_MESSAGE);
}

/**
 * Builds the optional delivery address schema. A missing or null value falls
 * back to `customers.direction`; a present value must have 1–500 characters.
 * @returns {import("yup").StringSchema} The address schema.
 */
function deliveryAddressField() {
  return yup
    .string()
    .transform((value) => {
      if (value === null || value === undefined) {
        return undefined;
      }

      return typeof value === "string" ? value.trim() : value;
    })
    .typeError(DELIVERY_ADDRESS_MESSAGE)
    .test("is-string", DELIVERY_ADDRESS_MESSAGE, function isString(value) {
      return value === undefined || typeof this.originalValue === "string";
    })
    .min(1, DELIVERY_ADDRESS_MESSAGE)
    .max(MAX_DELIVERY_ADDRESS_LENGTH, DELIVERY_ADDRESS_MESSAGE)
    .matches(/\S/, DELIVERY_ADDRESS_MESSAGE)
    .notRequired();
}

/**
 * Builds the optional notes schema. Blank strings become null.
 * @returns {import("yup").StringSchema} The notes schema.
 */
function notesField() {
  return yup
    .string()
    .transform((value) => {
      if (value === null || value === undefined) {
        return value;
      }

      if (typeof value !== "string") {
        return value;
      }

      const trimmed = value.trim();

      return trimmed === "" ? null : trimmed;
    })
    .typeError(NOTES_MESSAGE)
    .test("is-string", NOTES_MESSAGE, function isString(value) {
      return value == null || typeof this.originalValue === "string";
    })
    .max(MAX_NOTES_LENGTH, NOTES_MESSAGE)
    .nullable();
}

/**
 * Builds the optional payment term reference schema.
 * @returns {import("yup").NumberSchema} The nullable payment term id schema.
 */
function paymentTermIdField() {
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
    .nullable()
    .integer(PAYMENT_TERM_ID_MESSAGE)
    .min(1, PAYMENT_TERM_ID_MESSAGE)
    .typeError(PAYMENT_TERM_ID_MESSAGE);
}

const orderItemSchema = yup.object({
  product_id: positiveInteger(PRODUCT_ID_MESSAGE),
  item_state_id: positiveInteger(ITEM_STATE_ID_MESSAGE),
  quantity: quantityField(),
});

const createOrderSchema = yup.object({
  customer_id: positiveInteger(CUSTOMER_ID_MESSAGE).notRequired(),
  items: yup
    .array()
    .of(orderItemSchema)
    .typeError(ITEMS_ARRAY_MESSAGE)
    .max(MAX_ITEMS, ITEMS_MAX_MESSAGE)
    .notRequired(),
  delivery_address: deliveryAddressField(),
  notes: notesField(),
  payment_term_id: paymentTermIdField(),
});

const updateOrderSchema = yup.object({
  delivery_address: deliveryAddressField(),
  notes: notesField(),
});

const addItemSchema = orderItemSchema;

const updateItemSchema = yup.object({
  quantity: quantityField(),
});

const statusUpdateSchema = yup.object({
  status: yup
    .string()
    .transform((value) => (typeof value === "string" ? value.trim() : value))
    .typeError(STATUS_MESSAGE)
    .min(1, STATUS_MESSAGE)
    .max(20, STATUS_MESSAGE)
    .required(STATUS_MESSAGE),
});

const paymentTermUpdateSchema = yup.object({
  payment_term_id: paymentTermIdField()
    .transform((value) => (value === null ? NaN : value))
    .required(PAYMENT_TERM_ID_MESSAGE),
});

const CREATE_FIELDS = Object.freeze([]);
const ADD_ITEM_FIELDS = Object.freeze([
  "product_id",
  "item_state_id",
  "quantity",
]);
const UPDATE_ITEM_FIELDS = Object.freeze(["quantity"]);
const UPDATE_ORDER_FIELDS = Object.freeze([]);
const STATUS_FIELDS = Object.freeze(["status"]);
const PAYMENT_TERM_FIELDS = Object.freeze(["payment_term_id"]);

module.exports = {
  ADD_ITEM_FIELDS,
  CREATE_FIELDS,
  CUSTOMER_ID_MESSAGE,
  DELIVERY_ADDRESS_MESSAGE,
  ITEM_STATE_ID_MESSAGE,
  ITEMS_ARRAY_MESSAGE,
  ITEMS_MAX_MESSAGE,
  MAX_ITEMS,
  MAX_QUANTITY,
  MIN_QUANTITY,
  NOTES_MESSAGE,
  PAYMENT_TERM_FIELDS,
  PAYMENT_TERM_ID_MESSAGE,
  PRODUCT_ID_MESSAGE,
  QUANTITY_MAX_MESSAGE,
  QUANTITY_MIN_MESSAGE,
  QUANTITY_TYPE_MESSAGE,
  STATUS_FIELDS,
  STATUS_MESSAGE,
  UPDATE_ITEM_FIELDS,
  UPDATE_ORDER_FIELDS,
  addItemSchema,
  createOrderSchema,
  orderItemSchema,
  paymentTermUpdateSchema,
  statusUpdateSchema,
  updateItemSchema,
  updateOrderSchema,
};
