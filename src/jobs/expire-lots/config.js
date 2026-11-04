const defaultLogger = require("../../config/logger");

const DEFAULT_CONFIG = Object.freeze({
  enabled: true,
  hourUtc: 4,
  minuteUtc: 0,
  batchSize: 500,
});

const VARIABLES = Object.freeze({
  hourUtc: {
    name: "LOTS_EXPIRY_JOB_HOUR_UTC",
    min: 0,
    max: 23,
  },
  minuteUtc: {
    name: "LOTS_EXPIRY_JOB_MINUTE_UTC",
    min: 0,
    max: 59,
  },
  batchSize: {
    name: "LOTS_EXPIRY_JOB_BATCH_SIZE",
    min: 1,
    max: 5000,
  },
});

const INTEGER_PATTERN = /^\d+$/;

/**
 * Parses an integer environment value inside the documented range.
 * @param {object} definition - Variable definition.
 * @param {string} definition.name - Environment variable name.
 * @param {number} definition.min - Inclusive minimum.
 * @param {number} definition.max - Inclusive maximum.
 * @param {string|undefined} value - Raw environment value.
 * @param {number} fallback - Value used when missing or invalid.
 * @param {object} logger - Logger with a `warn` method.
 * @returns {number} The parsed value or the fallback.
 */
function parseInteger(definition, value, fallback, logger) {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  const normalized = String(value).trim();
  const parsed = INTEGER_PATTERN.test(normalized) ? Number(normalized) : NaN;

  if (parsed >= definition.min && parsed <= definition.max) {
    return parsed;
  }

  logger.warn(
    `Invalid ${definition.name}; using the default value ${fallback}`,
    { value },
  );

  return fallback;
}

/**
 * Parses the boolean flag. Only the literal `false` disables the scheduler.
 * @param {string|undefined} value - Raw environment value.
 * @returns {boolean} Whether the internal scheduler is enabled.
 */
function parseEnabled(value) {
  if (value === undefined || value === null || value === "") {
    return DEFAULT_CONFIG.enabled;
  }

  return String(value).trim().toLowerCase() !== "false";
}

/**
 * Loads the expire lots job configuration from the environment. Invalid
 * numeric values fall back to the documented defaults and log a warning.
 * @param {object} [env] - Environment variables.
 * @param {object} [logger] - Logger with a `warn` method.
 * @returns {{ enabled: boolean, hourUtc: number, minuteUtc: number,
 *   batchSize: number }} The resolved configuration.
 */
function loadConfig(env = process.env, logger = defaultLogger) {
  return {
    enabled: parseEnabled(env.LOTS_EXPIRY_JOB_ENABLED),
    hourUtc: parseInteger(
      VARIABLES.hourUtc,
      env.LOTS_EXPIRY_JOB_HOUR_UTC,
      DEFAULT_CONFIG.hourUtc,
      logger,
    ),
    minuteUtc: parseInteger(
      VARIABLES.minuteUtc,
      env.LOTS_EXPIRY_JOB_MINUTE_UTC,
      DEFAULT_CONFIG.minuteUtc,
      logger,
    ),
    batchSize: parseInteger(
      VARIABLES.batchSize,
      env.LOTS_EXPIRY_JOB_BATCH_SIZE,
      DEFAULT_CONFIG.batchSize,
      logger,
    ),
  };
}

module.exports = {
  DEFAULT_CONFIG,
  INTEGER_PATTERN,
  VARIABLES,
  loadConfig,
  parseEnabled,
  parseInteger,
};
