const { LEVELS } = require("./levels");

const RESET = "\u001b[0m";

/**
 * Tells whether ANSI colours should be applied.
 *
 * Colours are disabled when `NO_COLOR` is defined (de-facto standard) or when
 * stdout is not an interactive terminal, so CI/Docker logs stay readable.
 *
 * @returns {boolean}
 */
function colorsEnabled() {
  if (process.env.NO_COLOR !== undefined) {
    return false;
  }
  return Boolean(process.stdout.isTTY);
}

/**
 * Wraps `text` in an ANSI colour when colours are enabled.
 *
 * @param {string} text
 * @param {string} color
 * @returns {string}
 */
function colorize(text, color) {
  return colorsEnabled() ? `${color}${text}${RESET}` : text;
}

/**
 * Formats a single context value for the log line.
 *
 * @param {unknown} value
 * @returns {string}
 */
function formatValue(value) {
  if (value instanceof Error) {
    return value.message;
  }
  if (typeof value === "object" && value !== null) {
    return JSON.stringify(value);
  }
  return String(value);
}

/**
 * Renders the context as `key=value` pairs, skipping empty values.
 *
 * @param {Object<string, unknown>} context
 * @returns {string}
 */
function formatContext(context) {
  return Object.entries(context)
    .filter(
      ([, value]) => value !== undefined && value !== null && value !== "",
    )
    .map(([key, value]) => `${key}=${formatValue(value)}`)
    .join(" ");
}

/**
 * Indents every stack line so it is visually attached to its error line.
 *
 * @param {unknown} stack
 * @returns {string}
 */
function formatStack(stack) {
  return String(stack)
    .split("\n")
    .map((line) => `    ${line}`)
    .join("\n");
}

/**
 * Builds the full log line for a level from an already sanitized context.
 * The logger facade always passes an object, so `context` is required here.
 *
 * @param {import("./levels").LogLevel} level
 * @param {string} message
 * @param {Object<string, unknown>} context
 * @returns {string}
 */
function buildLine(level, message, context) {
  const timestamp = new Date().toISOString();
  const label = colorize(level.toUpperCase(), LEVELS[level].color);
  const { stack, ...rest } = context;
  const inline = formatContext(rest);

  let line = `${timestamp} ${label} ${message}`;
  if (inline && !stack) {
    line += ` ${inline}`;
  }
  if (stack) {
    line += `\n${formatStack(stack)}`;
    if (inline) {
      line += `\n    ${inline}`;
    }
  }
  return line;
}

module.exports = { colorsEnabled, colorize, buildLine };
