const crypto = require("crypto");

/**
 * Assigns a correlation id to every request.
 *
 * A client provided `X-Request-Id` header is respected; otherwise a new UUID
 * is generated. The value is exposed as `req.requestId` and echoed back in the
 * `X-Request-Id` response header so clients can correlate responses with logs.
 *
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 * @param {import("express").NextFunction} next
 * @returns {void}
 */
function requestId(req, res, next) {
  const provided = req.headers["x-request-id"];
  const value =
    typeof provided === "string" && provided.trim() !== ""
      ? provided
      : crypto.randomUUID();

  req.requestId = value;
  res.setHeader("X-Request-Id", value);
  next();
}

module.exports = requestId;
