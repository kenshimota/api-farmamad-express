const path = require("path");

const DEFAULT_PORT = 3001;
const PROJECT_ROOT = path.resolve(__dirname, "..", "..");

/**
 * Resolves the root folder where uploaded files are stored. `UPLOAD_DIR` is
 * optional and defaults to `<repo>/uploads`.
 * @returns {string} Absolute upload root.
 */
function getUploadDir() {
  const configured = process.env.UPLOAD_DIR;

  return configured
    ? path.resolve(configured)
    : path.join(PROJECT_ROOT, "uploads");
}

/**
 * Resolves the folder that stores the product originals and thumbnails.
 * @returns {string} Absolute products upload folder.
 */
function getProductsUploadDir() {
  return path.join(getUploadDir(), "products");
}

/**
 * Builds the public URL prefix used by `url` and `thumbnail`. `PUBLIC_BASE_URL`
 * is optional and defaults to `http://localhost:${PORT || 3001}`; trailing
 * slashes are removed so the stored URLs never contain a double slash.
 * @returns {string} Base URL without a trailing slash.
 */
function getPublicBaseUrl() {
  const configured =
    process.env.PUBLIC_BASE_URL ||
    `http://localhost:${process.env.PORT || DEFAULT_PORT}`;

  return configured.replace(/\/+$/, "");
}

module.exports = {
  DEFAULT_PORT,
  getProductsUploadDir,
  getPublicBaseUrl,
  getUploadDir,
};
