/**
 * Answers every unmatched route with a JSON `404`.
 *
 * Must be registered after all application routes and before the error
 * handler so unknown paths never fall through to Express' HTML error page.
 *
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 * @returns {void}
 */
function notFound(req, res) {
  res.status(404).json({ message: "Not found" });
}

module.exports = notFound;
