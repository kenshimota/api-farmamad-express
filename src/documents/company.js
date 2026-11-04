const fs = require("fs");
const logger = require("../config/logger");
const { companyProfileNotConfigured } = require("./errors");

const DEFAULT_COMPANY_NAME = "Farmamed";

/**
 * Reads an optional environment value.
 * @param {object} env - Environment source.
 * @param {string} key - Variable name.
 * @returns {string|null} The trimmed value or null.
 */
function optionalValue(env, key) {
  const value = env[key];

  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/**
 * Loads the emitter profile from the environment. RIF and address are
 * mandatory; phone, email and logo are optional and the logo is silently
 * skipped (with a warning) when it cannot be read.
 * @param {object} [options] - Injectable dependencies.
 * @param {object} [options.env] - Environment source.
 * @param {Function} [options.readFile] - File reader.
 * @param {object} [options.logger] - Logger with `warn`.
 * @returns {{ name: string, taxId: string, address: string,
 *   phone: string|null, email: string|null, logo: Buffer|null }} Profile.
 * @throws {Error} 503 when the mandatory emitter data is missing.
 */
function loadCompanyProfile({
  env = process.env,
  readFile = fs.readFileSync,
  logger: log = logger,
} = {}) {
  const taxId = optionalValue(env, "COMPANY_TAX_ID");
  const address = optionalValue(env, "COMPANY_ADDRESS");

  if (!taxId || !address) {
    throw companyProfileNotConfigured();
  }

  const logoPath = optionalValue(env, "COMPANY_LOGO_PATH");
  let logo = null;

  if (logoPath) {
    try {
      logo = readFile(logoPath);
    } catch (error) {
      log.warn("Company logo could not be read", { path: logoPath });
    }
  }

  return {
    name: optionalValue(env, "APP_NAME") ?? DEFAULT_COMPANY_NAME,
    taxId,
    address,
    phone: optionalValue(env, "COMPANY_PHONE"),
    email: optionalValue(env, "COMPANY_EMAIL"),
    logo,
  };
}

module.exports = { DEFAULT_COMPANY_NAME, loadCompanyProfile };
