const { isHttpError } = require("../shared/http-error");
const { readField } = require("../shared/serializer");
const {
  duplicatedItem,
  invalidItemState,
  productNotAvailable,
} = require("./errors");

/**
 * Normalizes the optional notes: trims them and turns a blank value into null.
 * @param {unknown} notes - Raw notes value.
 * @returns {string|null} The normalized notes.
 */
function normalizeNotes(notes) {
  if (typeof notes !== "string") {
    return null;
  }

  const trimmed = notes.trim();

  return trimmed === "" ? null : trimmed;
}

/**
 * Normalizes the delivery address, falling back to the customer direction.
 * @param {unknown} address - Raw address value.
 * @param {object} customer - Linked customer.
 * @returns {string} The address to persist.
 */
function normalizeAddress(address, customer) {
  if (typeof address === "string" && address.trim() !== "") {
    return address.trim();
  }

  return readField(customer, "direction");
}

/**
 * Rejects duplicated `(product_id, item_state_id)` pairs before any write.
 * @param {object[]} lines - Validated request lines.
 * @returns {void}
 * @throws {Error} 422 with the duplicated pair message.
 */
function assertNoDuplicates(lines) {
  const seen = new Set();

  for (const line of lines) {
    const key = `${line.product_id}:${line.item_state_id}`;

    if (seen.has(key)) {
      throw duplicatedItem(line.product_id, line.item_state_id);
    }

    seen.add(key);
  }
}

/**
 * Translates the shared pricing errors into the order line contract. A missing
 * price list keeps its 403, a missing default currency keeps its 503 and every
 * 422 becomes the documented `items` error.
 * @param {unknown} error - Error thrown by the price resolver.
 * @param {object} line - Requested line.
 * @returns {Error} The error that must be thrown.
 */
function translatePricingError(error, line) {
  if (!isHttpError(error)) {
    return error;
  }

  if (error.status === 403 || error.status === 503) {
    return error;
  }

  if (error.status === 422) {
    const details = error.body?.errors ?? {};

    if (details.item_state_id !== undefined) {
      return invalidItemState(line.item_state_id);
    }

    return productNotAvailable(line.product_id);
  }

  return error;
}

module.exports = {
  assertNoDuplicates,
  normalizeAddress,
  normalizeNotes,
  translatePricingError,
};
