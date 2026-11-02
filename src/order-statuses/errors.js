const { createHttpError } = require("../shared/http-error");
const { COMPLETE_MESSAGE } = require("./constants");

const NOT_FOUND_MESSAGE = "Order status not found";
const SYSTEM_DELETE_MESSAGE = "System order status cannot be deleted";
const IN_USE_MESSAGE = "Order status is in use";
const INVALID_NEXT_MESSAGE = "Invalid next status";
const SAME_NEXT_MESSAGE = "Next status cannot be the same";
const CYCLE_MESSAGE = "Status transition creates a cycle";
const ALREADY_EXISTS_MESSAGE = "Order status already exists";

/**
 * 404 response for an unknown order status.
 * @returns {Error & { status: number, body: object }} The HTTP error.
 */
function notFound() {
  return createHttpError(404, { message: NOT_FOUND_MESSAGE });
}

/**
 * 409 response for an attempt to delete one of the five base statuses.
 * @returns {Error & { status: number, body: object }} The HTTP error.
 */
function systemStatusNotDeletable() {
  return createHttpError(409, { message: SYSTEM_DELETE_MESSAGE });
}

/**
 * 409 response for a status referenced by orders, history or the chain.
 * @returns {Error & { status: number, body: object }} The HTTP error.
 */
function statusInUse() {
  return createHttpError(409, { message: IN_USE_MESSAGE });
}

/**
 * 409 response used when the code is already in the catalog.
 * @returns {Error & { status: number, body: object }} The HTTP error.
 */
function alreadyExists() {
  return createHttpError(409, { message: ALREADY_EXISTS_MESSAGE });
}

/**
 * 503 response used when the five base statuses are not available.
 * @returns {Error & { status: number, body: object }} The HTTP error.
 */
function configurationIncomplete() {
  return createHttpError(503, { message: COMPLETE_MESSAGE });
}

/**
 * 422 response for a `next_status_code` that does not exist.
 * @returns {Error & { status: number, body: object }} The HTTP error.
 */
function invalidNextStatus() {
  return createHttpError(422, {
    errors: { next_status_code: INVALID_NEXT_MESSAGE },
  });
}

/**
 * 422 response for a `next_status_code` equal to the current code.
 * @returns {Error & { status: number, body: object }} The HTTP error.
 */
function sameNextStatus() {
  return createHttpError(422, {
    errors: { next_status_code: SAME_NEXT_MESSAGE },
  });
}

/**
 * 422 response for a transition that would close a cycle.
 * @returns {Error & { status: number, body: object }} The HTTP error.
 */
function statusCycle() {
  return createHttpError(422, {
    errors: { next_status_code: CYCLE_MESSAGE },
  });
}

module.exports = {
  COMPLETE_MESSAGE,
  IN_USE_MESSAGE,
  INVALID_NEXT_MESSAGE,
  NOT_FOUND_MESSAGE,
  SAME_NEXT_MESSAGE,
  SYSTEM_DELETE_MESSAGE,
  ALREADY_EXISTS_MESSAGE,
  CYCLE_MESSAGE,
  alreadyExists,
  configurationIncomplete,
  invalidNextStatus,
  notFound,
  sameNextStatus,
  statusCycle,
  statusInUse,
  systemStatusNotDeletable,
};
