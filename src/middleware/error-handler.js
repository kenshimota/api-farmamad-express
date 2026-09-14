const logger = require("../config/logger");

/**
 * Central Express error handler built as a small Strategy chain.
 *
 * Each strategy knows how to classify one kind of error and how to answer it;
 * the handler only picks the first matching one. Adding a new class of error
 * (for example controlled errors forwarded through `next(error)`) means adding
 * a strategy, not editing branching logic.
 *
 * Guarantees every error response is JSON:
 * - malformed JSON bodies (`entity.parse.failed`) become `400`;
 * - any other unhandled error becomes a generic `500` while the real message
 *   and stack are written to the logs;
 * - if the response was already sent the error is forwarded to `next` so the
 *   stream is not broken.
 *
 * @typedef {Object} ErrorStrategy
 * @property {(error: Error) => boolean} matches
 * @property {(error: Error, req: import("express").Request, res: import("express").Response) => void} respond
 */

const INVALID_JSON_MESSAGE = "Invalid JSON body";
const GENERIC_MESSAGE = "Internal server error";

/**
 * Handles bodies rejected by `express.json()`.
 *
 * @type {ErrorStrategy}
 */
const malformedJsonStrategy = {
  matches: (error) => Boolean(error) && error.type === "entity.parse.failed",
  respond: (error, req, res) =>
    res.status(400).json({ message: INVALID_JSON_MESSAGE }),
};

/**
 * Fallback for any unhandled error: logs the technical detail and answers a
 * generic `500` that never leaks the cause. The optional `debug` field is only
 * added outside production.
 *
 * @type {ErrorStrategy}
 */
const internalErrorStrategy = {
  matches: () => true,
  respond: (error, req, res) => {
    const status = 500;

    logger.error(GENERIC_MESSAGE, {
      message: error && error.message,
      stack: error && error.stack,
      method: req.method,
      path: req.originalUrl,
      status,
      requestId: req.requestId,
    });

    const body = { message: GENERIC_MESSAGE };
    if (process.env.NODE_ENV === "development") {
      body.debug = error && error.message;
    }

    // The request-id middleware already echoes this header for every request;
    // setting it here too keeps the 500 contract (RF-05) intact even when the
    // error handler is used without that middleware in the chain.
    res.setHeader("X-Request-Id", req.requestId);
    res.status(status).json(body);
  },
};

/** Ordered strategies; the last one is the always-matching fallback. */
const STRATEGIES = [malformedJsonStrategy, internalErrorStrategy];

/**
 * @param {Error & { type?: string, status?: number }} error
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 * @param {import("express").NextFunction} next
 * @returns {void}
 */
function errorHandler(error, req, res, next) {
  if (res.headersSent) {
    return next(error);
  }

  const strategy = STRATEGIES.find((candidate) => candidate.matches(error));
  strategy.respond(error, req, res);
}

module.exports = errorHandler;
