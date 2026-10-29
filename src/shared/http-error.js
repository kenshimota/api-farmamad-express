/**
 * Tells whether an error carries the HTTP status and body built by the service
 * layer, so routers can answer it without a database-specific translation.
 * @param {unknown} error - Error thrown by a service.
 * @returns {boolean} True when the error is an HTTP error.
 */
function isHttpError(error) {
  return (
    Boolean(error) && typeof error.status === "number" && Boolean(error.body)
  );
}

/**
 * Sends the status and body carried by an HTTP error.
 * @param {import("express").Response} res - Express response.
 * @param {Error & { status: number, body: object }} error - HTTP error.
 * @returns {import("express").Response} The error response.
 */
function sendHttpError(res, error) {
  return res.status(error.status).json(error.body);
}

module.exports = { isHttpError, sendHttpError };
