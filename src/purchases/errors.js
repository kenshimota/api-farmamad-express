const { createHttpError } = require("../shared/http-error");

/**
 * Builds an error that carries the HTTP status and body a router must send.
 * The service layer throws these errors and stays free of Express objects.
 * @param {number} status - HTTP status code.
 * @param {object} body - JSON response body.
 * @returns {Error & { status: number, body: object }} The HTTP error.
 */
function httpError(status, body) {
  return createHttpError(status, body, "Purchase error");
}

/**
 * 404 response for an unknown purchase.
 * @returns {Error} The HTTP error.
 */
function purchaseNotFound() {
  return httpError(404, { message: "Purchase not found" });
}

/**
 * 404 response for a line that does not belong to the purchase.
 * @returns {Error} The HTTP error.
 */
function itemNotFound() {
  return httpError(404, { message: "Item not found" });
}

/**
 * 409 response used by every mutation over a non-draft purchase.
 * @returns {Error} The HTTP error.
 */
function notEditable() {
  return httpError(409, { message: "Purchase is not editable" });
}

/**
 * 409 response used when a draft already contains the product/item state pair.
 * @returns {Error} The HTTP error.
 */
function itemAlreadyExists() {
  return httpError(409, { message: "Item already exists" });
}

/**
 * 422 response used when a purchase without lines is confirmed.
 * @returns {Error} The HTTP error.
 */
function purchaseHasNoItems() {
  return httpError(422, { message: "Purchase has no items" });
}

/**
 * 422 response used when a line lacks its lot data on confirmation.
 * @returns {Error} The HTTP error.
 */
function missingLotData() {
  return httpError(422, {
    errors: { items: "Every item requires lot_number and expiration_date" },
  });
}

/**
 * 409 response used when the same product already has a lot number with a
 * different item state or expiration date.
 * @returns {Error} The HTTP error.
 */
function incompatibleLot() {
  return httpError(409, { message: "Lot already exists with different data" });
}

module.exports = {
  httpError,
  itemAlreadyExists,
  incompatibleLot,
  itemNotFound,
  missingLotData,
  notEditable,
  purchaseHasNoItems,
  purchaseNotFound,
};
