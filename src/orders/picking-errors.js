const { createHttpError } = require("../shared/http-error");

const INVALID_ALLOCATION_STATUS_MESSAGE = "Invalid allocation_status";

/**
 * 422 response used when `allocation_status` is not a supported filter.
 * @returns {Error & { status: number, body: object }} The HTTP error.
 */
function invalidAllocationStatus() {
  return createHttpError(422, {
    errors: { allocation_status: INVALID_ALLOCATION_STATUS_MESSAGE },
  });
}

module.exports = {
  INVALID_ALLOCATION_STATUS_MESSAGE,
  invalidAllocationStatus,
};
