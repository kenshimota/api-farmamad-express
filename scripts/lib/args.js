const path = require("path");

const DEFAULT_LIMIT = 120;
const MIN_LIMIT = 100;
const DEFAULT_DELAY = 1000;
const MIN_DELAY = 1000;
const DEFAULT_OUT = path.resolve("seeders", "data", "demo-products.json");

/**
 * Parses an integer option value.
 * @param {string} name - Option name.
 * @param {string} value - Raw value.
 * @returns {number} Parsed integer.
 * @throws {Error} When the value is not an integer.
 */
function parseInteger(name, value) {
  if (!/^\d+$/.test(value)) {
    throw new Error(`${name} must be an integer, received "${value}".`);
  }

  return Number(value);
}

/**
 * Parses the scraper arguments. The rate limit can only be relaxed to one
 * second or slower, never tightened.
 * @param {string[]} argv - Arguments without the node and script entries.
 * @returns {{ limit: number, out: string, delay: number }} Parsed options.
 * @throws {Error} When an option is unknown or out of range.
 */
function parseArgs(argv = []) {
  const options = {
    limit: DEFAULT_LIMIT,
    out: DEFAULT_OUT,
    delay: DEFAULT_DELAY,
  };

  for (const argument of argv) {
    const match = argument.match(/^--([^=]+)(?:=(.*))?$/);

    if (!match) {
      throw new Error(`Unknown option "${argument}".`);
    }

    const [, name, rawValue] = match;

    if (name === "out" && rawValue === undefined) {
      throw new Error("--out requires a value.");
    }

    if (name === "limit") {
      options.limit = parseInteger("limit", rawValue ?? "");
      if (options.limit < MIN_LIMIT) {
        throw new Error(`--limit must be at least ${MIN_LIMIT}.`);
      }
    } else if (name === "delay") {
      options.delay = parseInteger("delay", rawValue ?? "");
      if (options.delay < MIN_DELAY) {
        throw new Error(`--delay must be at least ${MIN_DELAY} ms.`);
      }
    } else if (name === "out") {
      options.out = path.resolve(rawValue);
    } else {
      throw new Error(`Unknown option "--${name}".`);
    }
  }

  return options;
}

module.exports = {
  DEFAULT_DELAY,
  DEFAULT_LIMIT,
  DEFAULT_OUT,
  MIN_DELAY,
  MIN_LIMIT,
  parseArgs,
};
