const logger = require("../config/logger");

/**
 * Logs one access line per request once the response has finished.
 *
 * Uses `logger.warn` for `4xx` responses and `logger.info` otherwise. Only the
 * method, path, status and request id are logged: the request body and
 * sensitive headers (`Authorization`, `Cookie`) are never included.
 *
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 * @param {import("express").NextFunction} next
 * @returns {void}
 */
function requestLogger(req, res, next) {
  res.on("finish", () => {
    const level =
      res.statusCode >= 400 && res.statusCode < 500 ? "warn" : "info";
    logger[level](`${res.statusCode} ${req.method} ${req.originalUrl}`, {
      requestId: req.requestId,
    });
  });

  next();
}

module.exports = requestLogger;
