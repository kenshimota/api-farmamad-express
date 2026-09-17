const DEFAULT_APP_NAME = "Super King";
const DEFAULT_APP_URL = "https://dashboard.asic-guanipa.online/";

/**
 * Reads `APP_NAME` and resolves the product name shown in the emails.
 *
 * An unset or empty variable falls back to {@link DEFAULT_APP_NAME}. The value
 * is read on every call so a configuration change is reflected without
 * reloading the module.
 *
 * @returns {string} Resolved product name.
 */
function getProductName() {
  return process.env.APP_NAME || DEFAULT_APP_NAME;
}

/**
 * Reads `APP_URL` and resolves the web link included in the emails.
 *
 * An unset or empty variable falls back to {@link DEFAULT_APP_URL}. The
 * configured value is returned exactly as-is, keeping its trailing slash when
 * present.
 *
 * @returns {string} Resolved web link.
 */
function getProductUrl() {
  return process.env.APP_URL || DEFAULT_APP_URL;
}

module.exports = {
  DEFAULT_APP_NAME,
  DEFAULT_APP_URL,
  getProductName,
  getProductUrl,
};
