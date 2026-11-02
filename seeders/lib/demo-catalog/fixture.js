const fs = require("fs/promises");
const path = require("path");
const { validateFixture } = require("./validate");

const PROJECT_ROOT = path.resolve(__dirname, "..", "..", "..");
const DEFAULT_FIXTURE_PATH = path.join(
  PROJECT_ROOT,
  "seeders",
  "data",
  "demo-products.json",
);
const DEFAULT_ASSETS_DIR = path.join(
  PROJECT_ROOT,
  "seeders",
  "assets",
  "demo",
  "products",
);

/**
 * Reads and validates the versioned demo fixture. It never downloads data.
 * @param {string} [filePath] - Fixture path.
 * @param {{ minimum?: number }} [options] - Validation options.
 * @returns {Promise<{ products: object[], fixture: object }>} Validated data.
 * @throws {Error} When the file is missing or invalid.
 */
async function loadFixture(filePath = DEFAULT_FIXTURE_PATH, options = {}) {
  let contents;

  try {
    contents = await fs.readFile(filePath, "utf8");
  } catch (error) {
    throw new Error(
      `Demo fixture not found at ${filePath}. Run "npm run seed:scrape" first or restore the versioned fixture.`,
    );
  }

  let parsed;
  try {
    parsed = JSON.parse(contents);
  } catch (error) {
    throw new Error(
      `Demo fixture at ${filePath} is not valid JSON: ${error.message}`,
    );
  }

  const fixture = validateFixture(parsed, options);

  return { fixture, products: fixture.products };
}

module.exports = {
  DEFAULT_ASSETS_DIR,
  DEFAULT_FIXTURE_PATH,
  PROJECT_ROOT,
  loadFixture,
};
