const { LEVELS, isEnabled } = require("./levels");
const { sanitize } = require("./redact");
const { buildLine } = require("./format");

/**
 * Minimal dependency-free logger with ANSI level highlights.
 *
 * Each line contains an ISO timestamp, a coloured level label, the message and
 * an optional context. Secret-looking context keys are redacted, colours are
 * disabled when stdout is not an interactive terminal or when the `NO_COLOR`
 * environment variable is defined, and `LOG_LEVEL` filters lower priorities.
 *
 * @typedef {import("./levels").LogLevel} LogLevel
 * @typedef {Object<string, unknown>} LogContext
 */

/**
 * Prints a log line when the configured level allows it.
 *
 * @param {LogLevel} level
 * @param {string} message
 * @param {LogContext} [context]
 * @returns {void}
 */
function write(level, message, context) {
  if (!isEnabled(level)) {
    return;
  }
  const safeContext = context ? sanitize(context) : {};
  LEVELS[level].sink(buildLine(level, message, safeContext));
}

const logger = {
  /**
   * Logs a normal event.
   *
   * @param {string} message
   * @param {LogContext} [context]
   * @returns {void}
   */
  info(message, context) {
    write("info", message, context);
  },
  /**
   * Logs an anomalous but expected event.
   *
   * @param {string} message
   * @param {LogContext} [context]
   * @returns {void}
   */
  warn(message, context) {
    write("warn", message, context);
  },
  /**
   * Logs an internal error.
   *
   * @param {string} message
   * @param {LogContext} [context]
   * @returns {void}
   */
  error(message, context) {
    write("error", message, context);
  },
};

module.exports = logger;
