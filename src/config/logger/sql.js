const { colorize } = require("./format");

/**
 * Sequelize query logging.
 *
 * In development every SQL statement is printed colour-coded by its operation
 * and, when Sequelize's `benchmark` option is enabled, with its execution time
 * in milliseconds. The mapping is a lookup table so new operations only mean
 * extending {@link OPERATION_COLORS}.
 */

const OPERATION_COLORS = {
  SELECT: "\u001b[34m",
  UPDATE: "\u001b[33m",
  INSERT: "\u001b[32m",
  DELETE: "\u001b[31m",
};

const DEFAULT_OPERATION = "SQL";
const DEFAULT_COLOR = "\u001b[90m";

const SEQUELIZE_PREFIX = /^(?:Executing|Executed)\s*\([^)]*\):\s*/;
const OPERATION_PATTERN = /\b(SELECT|INSERT|UPDATE|DELETE)\b/i;

/**
 * Tells whether query logging is active: only in `development`.
 *
 * @returns {boolean}
 */
function isQueryLoggingEnabled() {
  return process.env.NODE_ENV === "development";
}

/**
 * Removes the `Executed (default):` prefix Sequelize adds to its log messages.
 *
 * @param {unknown} sql
 * @returns {string}
 */
function stripPrefix(sql) {
  return String(sql).replace(SEQUELIZE_PREFIX, "").trim();
}

/**
 * Classifies a statement by the operation it performs.
 *
 * @param {unknown} sql
 * @returns {string} One of the keys of {@link OPERATION_COLORS} or `"SQL"`.
 */
function detectOperation(sql) {
  const match = String(sql).match(OPERATION_PATTERN);
  return match ? match[1].toUpperCase() : DEFAULT_OPERATION;
}

/**
 * Builds the colour-coded log line for a query.
 *
 * @param {unknown} sql
 * @param {unknown} [timing] - Execution time in milliseconds, if available.
 * @returns {string}
 */
function formatQuery(sql, timing) {
  const operation = detectOperation(sql);
  const color = OPERATION_COLORS[operation] || DEFAULT_COLOR;
  const statement = stripPrefix(sql);
  const duration = typeof timing === "number" ? ` (${timing} ms)` : "";

  return `${new Date().toISOString()} ${color}${statement}${duration}${DEFAULT_COLOR}`;
}

/**
 * Sequelize logging sink. Signature matches `(sql, timing)`.
 *
 * @param {unknown} sql
 * @param {unknown} [timing]
 * @returns {void}
 */
function logQuery(sql, timing) {
  console.log(formatQuery(sql, timing));
}

module.exports = {
  OPERATION_COLORS,
  detectOperation,
  formatQuery,
  isQueryLoggingEnabled,
  logQuery,
};
