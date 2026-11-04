/**
 * Error raised when the destination `expired` item state is missing. The job
 * must abort without changing any lot, so the service throws this error from
 * inside the transaction.
 */
class ExpiredItemStateNotFoundError extends Error {
  /**
   * @param {string} [message] - Human readable message.
   */
  constructor(message = 'Item state "expired" was not found') {
    super(message);
    this.name = "ExpiredItemStateNotFoundError";
    this.code = "EXPIRED_ITEM_STATE_NOT_FOUND";
  }
}

module.exports = { ExpiredItemStateNotFoundError };
