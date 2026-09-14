/**
 * Secret redaction for log context.
 *
 * The logger must never print passwords, tokens, recovery codes or password
 * hashes, so every context object goes through {@link sanitize} before it is
 * formatted.
 */

const REDACTED = "[REDACTED]";

const SENSITIVE_KEYS = new Set([
  "password",
  "passwordconfirmation",
  "password_confirmation",
  "token",
  "accesstoken",
  "refreshtoken",
  "authorization",
  "cookie",
  "secret",
  "jwt",
  "code",
  "codehash",
  "recoverycode",
]);

/**
 * Checks whether a context key may hold a secret.
 *
 * @param {string} key
 * @returns {boolean}
 */
function isSensitiveKey(key) {
  return SENSITIVE_KEYS.has(String(key).toLowerCase());
}

/**
 * Recursively redacts sensitive keys from a context object.
 *
 * @param {unknown} value
 * @param {number} [depth]
 * @returns {unknown}
 */
function sanitize(value, depth = 0) {
  if (depth > 4 || value === null || typeof value !== "object") {
    return value;
  }
  if (value instanceof Error) {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => sanitize(item, depth + 1));
  }
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [
      key,
      isSensitiveKey(key) ? REDACTED : sanitize(item, depth + 1),
    ]),
  );
}

module.exports = { REDACTED, SENSITIVE_KEYS, isSensitiveKey, sanitize };
