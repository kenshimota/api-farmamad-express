/**
 * Level definitions for the logger.
 *
 * Every level is a small strategy object bundling its ordering priority, the
 * ANSI colour applied to its label and the console sink used to print it.
 * Adding a level only means extending this table: the logger never branches on
 * level names.
 *
 * @typedef {"info"|"warn"|"error"} LogLevel
 */

const LEVELS = {
  info: {
    priority: 0,
    color: "\u001b[32m",
    sink: (...args) => console.log(...args),
  },
  warn: {
    priority: 1,
    color: "\u001b[33m",
    sink: (...args) => console.warn(...args),
  },
  error: {
    priority: 2,
    color: "\u001b[31m",
    sink: (...args) => console.error(...args),
  },
};

const DEFAULT_LEVEL = "info";

/**
 * Returns the configured minimum level, falling back to `info` when
 * `LOG_LEVEL` is missing or unknown.
 *
 * @returns {LogLevel}
 */
function resolveLevel() {
  const value = String(process.env.LOG_LEVEL || DEFAULT_LEVEL).toLowerCase();
  return Object.prototype.hasOwnProperty.call(LEVELS, value)
    ? /** @type {LogLevel} */ (value)
    : DEFAULT_LEVEL;
}

/**
 * Tells whether a level must be printed given `LOG_LEVEL`.
 *
 * @param {LogLevel} level
 * @returns {boolean}
 */
function isEnabled(level) {
  return LEVELS[level].priority >= LEVELS[resolveLevel()].priority;
}

module.exports = { LEVELS, DEFAULT_LEVEL, resolveLevel, isEnabled };
