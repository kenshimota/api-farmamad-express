const yup = require("yup");

const REQUIRED_ASSIGNMENT_FIELDS = Object.freeze(["customer_id", "seller_id"]);
const UPDATE_ASSIGNMENT_FIELDS = Object.freeze(["seller_id"]);
const INVALID_CUSTOMER_MESSAGE = "Invalid customer";
const INVALID_SELLER_MESSAGE = "Invalid seller";

/**
 * Builds a required positive integer identifier schema.
 * @param {string} message - Error message for invalid values.
 * @returns {import("yup").NumberSchema} The identifier schema.
 */
function positiveIntegerField(message) {
  return yup
    .number()
    .transform((value) => (value === null ? NaN : value))
    .typeError(message)
    .integer(message)
    .min(1, message)
    .required(message);
}

const createCustomerSellerSchema = yup.object({
  customer_id: positiveIntegerField(INVALID_CUSTOMER_MESSAGE),
  seller_id: positiveIntegerField(INVALID_SELLER_MESSAGE),
});

const updateCustomerSellerSchema = yup.object({
  seller_id: positiveIntegerField(INVALID_SELLER_MESSAGE),
  // Kept as-is so the router can compare it with the stored customer and
  // answer the documented `customer_id cannot be changed` error.
  customer_id: yup.mixed(),
});

module.exports = {
  INVALID_CUSTOMER_MESSAGE,
  INVALID_SELLER_MESSAGE,
  REQUIRED_ASSIGNMENT_FIELDS,
  UPDATE_ASSIGNMENT_FIELDS,
  createCustomerSellerSchema,
  updateCustomerSellerSchema,
};
