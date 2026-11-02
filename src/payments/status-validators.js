const yup = require("yup");
const { PAYMENT_STATUS } = require("./statuses");

const STATUS_REQUIRED_MESSAGE = "status is required";
const INVALID_STATUS_MESSAGE = "Invalid status";
const REASON_REQUIRED_MESSAGE =
  "reason is required when the payment is rejected";
const REASON_MAX_MESSAGE = "reason must be at most 500 characters";

/**
 * Trims the reason and stores a blank value as null.
 * @param {unknown} value - Raw reason.
 * @returns {string|null|unknown} Normalized reason.
 */
function normalizeReason(value) {
  if (typeof value !== "string") {
    return value;
  }

  const trimmed = value.trim();

  return trimmed === "" ? null : trimmed;
}

const changePaymentStatusSchema = yup
  .object({
    status: yup
      .string()
      .typeError(INVALID_STATUS_MESSAGE)
      .oneOf(
        [PAYMENT_STATUS.CONCILIATED, PAYMENT_STATUS.REJECTED],
        INVALID_STATUS_MESSAGE,
      )
      .required(STATUS_REQUIRED_MESSAGE),
    reason: yup
      .string()
      .transform(normalizeReason)
      .nullable()
      .typeError(REASON_MAX_MESSAGE)
      .max(500, REASON_MAX_MESSAGE),
  })
  .test(
    "rejected-reason",
    REASON_REQUIRED_MESSAGE,
    function validateRejectedReason(value) {
      if (value?.status !== "rejected") {
        return true;
      }

      if (typeof value.reason === "string" && value.reason.length >= 3) {
        return true;
      }

      return this.createError({
        path: "reason",
        message: REASON_REQUIRED_MESSAGE,
      });
    },
  );

module.exports = {
  INVALID_STATUS_MESSAGE,
  REASON_MAX_MESSAGE,
  REASON_REQUIRED_MESSAGE,
  STATUS_REQUIRED_MESSAGE,
  changePaymentStatusSchema,
  normalizeReason,
};
