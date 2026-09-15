const WILDCARD_ORIGIN = "*";
const ALLOWED_METHODS = "GET,POST,PUT,PATCH,DELETE,OPTIONS";
const ALLOWED_HEADERS = "Content-Type,Authorization,X-Request-Id";
const EXPOSED_HEADERS = "X-Request-Id";
const MAX_AGE_SECONDS = "86400";

/**
 * Resolved CORS policy for one request.
 *
 * @typedef {Object} CorsPolicy
 * @property {boolean} wildcard - When true every origin is allowed.
 * @property {string[]} origins - Explicit allowlist used when `wildcard` is false.
 */

/**
 * Reads `CORS_ORIGIN` and resolves the origin policy.
 *
 * An unset or empty variable means "allow every origin". A comma separated
 * value becomes an explicit allowlist. The variable is read per request so
 * tests (and future configuration reloads) can change it without reloading the
 * module.
 *
 * `*` is a temporary and explicit decision: the API stays open to every origin
 * while there is no definitive domain list. When that list exists, set
 * `CORS_ORIGIN` to the production domains; no code change will be needed.
 *
 * @returns {CorsPolicy} The policy applied to the request.
 */
function resolvePolicy() {
  const raw = process.env.CORS_ORIGIN;

  if (typeof raw !== "string" || raw.trim() === "") {
    return { wildcard: true, origins: [] };
  }

  const origins = raw
    .split(",")
    .map((origin) => origin.trim())
    .filter((origin) => origin !== "");

  if (origins.length === 0) {
    return { wildcard: true, origins: [] };
  }

  return { wildcard: false, origins };
}

/**
 * Adds `Origin` to the `Vary` response header without duplicating it.
 *
 * Required whenever the response depends on the request origin: shared caches
 * must not reuse an allowed origin's response for a different origin.
 *
 * @param {import("express").Response} res
 * @param {string} value - Header value to append.
 * @returns {void}
 */
function appendVary(res, value) {
  const current = res.getHeader("Vary");

  if (current === undefined) {
    res.setHeader("Vary", value);
    return;
  }

  const values = String(current)
    .split(",")
    .map((item) => item.trim());

  if (!values.includes(value)) {
    res.setHeader("Vary", `${current}, ${value}`);
  }
}

/**
 * Resolves which `Access-Control-Allow-Origin` value the response must carry.
 *
 * The wildcard policy always answers `*`. With an allowlist the request origin
 * is echoed only when it is explicitly allowed; otherwise `null` means "do not
 * set the header", so the browser blocks the response.
 *
 * @param {CorsPolicy} policy - Policy resolved from `CORS_ORIGIN`.
 * @param {string|undefined} requestOrigin - Value of the request `Origin` header.
 * @returns {string|null} Origin to echo, `*`, or `null` to omit the header.
 */
function resolveAllowedOrigin(policy, requestOrigin) {
  if (policy.wildcard) {
    return WILDCARD_ORIGIN;
  }

  if (
    typeof requestOrigin === "string" &&
    policy.origins.includes(requestOrigin)
  ) {
    return requestOrigin;
  }

  return null;
}

/**
 * Applies the origin and exposed-headers CORS headers to the response.
 *
 * With the wildcard policy every response advertises `*`. With an allowlist
 * only a matching request origin is echoed (the browser blocks the rest) and
 * `Vary: Origin` is always set so caches stay correct.
 * `Access-Control-Allow-Credentials` is intentionally never sent: the API
 * authenticates with `Authorization: Bearer`, not cookies, and the header is
 * incompatible with a wildcard origin.
 *
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 * @returns {void}
 */
function applyCorsHeaders(req, res) {
  const policy = resolvePolicy();

  if (!policy.wildcard) {
    appendVary(res, "Origin");
  }

  const allowedOrigin = resolveAllowedOrigin(policy, req.headers.origin);
  if (allowedOrigin !== null) {
    res.setHeader("Access-Control-Allow-Origin", allowedOrigin);
  }

  res.setHeader("Access-Control-Expose-Headers", EXPOSED_HEADERS);
}

/**
 * Checks whether a layer matches the request path.
 *
 * Route layers are matched directly. Mounted routers are matched against the
 * request path and then searched recursively with the remaining path, which is
 * how `/users/:id/status` is found without executing any business logic.
 *
 * @param {Object} layer - Express router layer.
 * @param {string} path - Request pathname.
 * @returns {boolean} True when the layer handles the path.
 */
function layerMatches(layer, path) {
  if (layer.route) {
    return Boolean(layer.match(path));
  }

  const handle = layer.handle;
  if (!handle || !Array.isArray(handle.stack)) {
    return false;
  }

  if (!layer.match(path)) {
    return false;
  }

  const mountPath = layer.path || "";
  const remainingPath = path.slice(mountPath.length) || "/";

  return stackMatches(handle.stack, remainingPath);
}

/**
 * @param {Object[]} stack - Express router stack.
 * @param {string} path - Request pathname.
 * @returns {boolean} True when any layer handles the path.
 */
function stackMatches(stack, path) {
  return stack.some((layer) => layerMatches(layer, path));
}

/**
 * Reports whether the app exposes a route for the request path.
 *
 * The preflight needs to answer `204` for existing routes and let unknown
 * paths fall through to the JSON `404`. Inspecting the app router is enough to
 * tell them apart and, unlike the router default OPTIONS handling, it also
 * works with the final `notFound` middleware. If the router cannot be
 * inspected the path is assumed to exist, so preflights keep working.
 *
 * @param {import("express").Request} req
 * @returns {boolean} True when the request path matches a route or router.
 */
function routeExists(req) {
  const router = req.app && req.app.router;

  if (!router || !Array.isArray(router.stack)) {
    return true;
  }

  try {
    return stackMatches(router.stack, req.path);
  } catch (error) {
    // Malformed paths are left to Express so it can answer as usual.
    return false;
  }
}

/**
 * Answers a preflight request with `204` and the negotiated CORS headers.
 *
 * @param {import("express").Response} res
 * @returns {void}
 */
function answerPreflight(res) {
  res.setHeader("Access-Control-Allow-Methods", ALLOWED_METHODS);
  res.setHeader("Access-Control-Allow-Headers", ALLOWED_HEADERS);
  res.setHeader("Access-Control-Max-Age", MAX_AGE_SECONDS);
  res.status(204).end();
}

/**
 * CORS middleware for the whole API.
 *
 * Registered once, before the JSON parser and every router, so it:
 * - adds the CORS headers to every response, including the ones produced by
 *   the not-found and error handlers;
 * - resolves preflights for existing routes without touching the database or
 *   any business logic;
 * - lets `OPTIONS` requests to unknown paths fall through to the JSON `404`.
 *
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 * @param {import("express").NextFunction} next
 * @returns {void}
 */
function cors(req, res, next) {
  applyCorsHeaders(req, res);

  if (req.method === "OPTIONS" && routeExists(req)) {
    answerPreflight(res);
    return;
  }

  next();
}

module.exports = cors;
