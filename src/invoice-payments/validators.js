const yup = require("yup");

const REQUIRED_INVOICE_PAYMENT_FIELDS = Object.freeze(["payment_id", "amount"]);
const PAYMENT_ID_MESSAGE = "payment_id must be a positive integer";
const AMOUNT_MESSAGE = "amount must be a positive number with two decimals";

/**
 * Builds the positive integer schema used by `payment_id`.
 * @returns {import("yup").NumberSchema} The id schema.
 */
function paymentIdField() {
  return yup
    .number()
    .transform((value, originalValue) => {
      if (
        originalValue === null ||
        (typeof originalValue === "string" && originalValue.trim() === "")
      ) {
        return NaN;
      }

      return value;
    })
    .typeError(PAYMENT_ID_MESSAGE)
    .test("is-integer-string", PAYMENT_ID_MESSAGE, function isInteger(value) {
      if (value === undefined) {
        return true;
      }

      if (typeof this.originalValue === "number") {
        return Number.isInteger(this.originalValue);
      }

      return (
        typeof this.originalValue === "string" &&
        /^\d+$/.test(this.originalValue.trim())
      );
    })
    .integer(PAYMENT_ID_MESSAGE)
    .positive(PAYMENT_ID_MESSAGE)
    .required(PAYMENT_ID_MESSAGE);
}

/**
 * Builds the positive amount schema with at most two decimals.
 * @returns {import("yup").NumberSchema} The amount schema.
 */
function amountField() {
  return yup
    .number()
    .transform((value, originalValue) => {
      if (
        originalValue === null ||
        (typeof originalValue === "string" && originalValue.trim() === "")
      ) {
        return NaN;
      }

      return value;
    })
    .typeError(AMOUNT_MESSAGE)
    .positive(AMOUNT_MESSAGE)
    .test("two-decimals", AMOUNT_MESSAGE, function validateDecimals(value) {
      if (value === undefined) {
        return true;
      }

      if (typeof this.originalValue === "number") {
        return Number(this.originalValue.toFixed(2)) === this.originalValue;
      }

      return (
        typeof this.originalValue === "string" &&
        /^\d+(\.\d{1,2})?$/.test(this.originalValue.trim())
      );
    })
    .required(AMOUNT_MESSAGE);
}

const applyInvoicePaymentSchema = yup.object({
  payment_id: paymentIdField(),
  amount: amountField(),
});

/**
 * Reads the validated values from a request body. Routes validate and strip
 * the body first, so this helper only normalizes the numeric types.
 * @param {object} [body] - Validated request body.
 * @returns {{ payment_id: number, amount: number }} Service values.
 */
function parseInvoicePaymentBody(body = {}) {
  return {
    payment_id: Number(body.payment_id),
    amount: Number(body.amount),
  };
}

module.exports = {
  AMOUNT_MESSAGE,
  PAYMENT_ID_MESSAGE,
  REQUIRED_INVOICE_PAYMENT_FIELDS,
  amountField,
  applyInvoicePaymentSchema,
  parseInvoicePaymentBody,
  paymentIdField,
};
