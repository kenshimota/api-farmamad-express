const path = require("path");

const TAX_CODES = Object.freeze(new Set(["IVA", "SIN_IVA"]));
const MINIMUM_PRODUCTS = 100;
const COST_PATTERN = /^\d+(\.\d{1,2})?$/;

/**
 * Error raised when the demo fixture does not satisfy its contract.
 */
class FixtureValidationError extends Error {
  /**
   * @param {string} message - Actionable message.
   */
  constructor(message) {
    super(message);
    this.name = "FixtureValidationError";
  }
}

/**
 * Requires a non-empty string and trims it.
 * @param {*} value - Candidate value.
 * @param {string} field - Field name used in the error.
 * @param {number} [maxLength] - Optional maximum length.
 * @returns {string} Trimmed value.
 * @throws {FixtureValidationError} When the value is blank.
 */
function requireText(value, field, maxLength) {
  if (typeof value !== "string" || !value.trim()) {
    throw new FixtureValidationError(`Demo product ${field} is required.`);
  }

  const text = value.trim();

  if (maxLength && text.length > maxLength) {
    throw new FixtureValidationError(
      `Demo product ${field} must not exceed ${maxLength} characters.`,
    );
  }

  return text;
}

/**
 * Requires a safe file name inside the demo assets folder.
 * @param {*} value - Candidate file name.
 * @param {string} field - Field name used in the error.
 * @returns {string} Safe file name.
 * @throws {FixtureValidationError} When it is not a plain file name.
 */
function requireFileName(value, field) {
  const name = requireText(value, field);

  if (path.basename(name) !== name || name.includes("..")) {
    throw new FixtureValidationError(
      `Demo product ${field} must be a plain file name.`,
    );
  }

  return name;
}

/**
 * Normalizes and validates the cost: finite, non-negative and at most two
 * decimals. The fixture stores costs in the default transaction currency.
 * @param {*} value - Candidate cost.
 * @returns {number} Normalized cost.
 * @throws {FixtureValidationError} When it is invalid.
 */
function requireCost(value) {
  const text = typeof value === "number" ? String(value) : String(value ?? "");

  if (!COST_PATTERN.test(text)) {
    throw new FixtureValidationError(
      "Demo product cost must be a non-negative number with at most two decimals.",
    );
  }

  return Number(text);
}

/**
 * Validates and normalizes one fixture product.
 * @param {object} raw - Candidate product.
 * @param {number} [index] - Position in the fixture, for error messages.
 * @returns {object} Normalized product.
 * @throws {FixtureValidationError} When a required field is invalid.
 */
function validateProduct(raw, index = 0) {
  if (!raw || typeof raw !== "object") {
    throw new FixtureValidationError(
      `Demo product at index ${index} is invalid.`,
    );
  }

  const externalId = requireText(raw.external_id, "external_id", 80);
  const name = requireText(raw.name, "name", 150);
  const reference = requireText(raw.reference, "reference", 100);
  const category = requireText(raw.category, "category", 100);
  const taxCode = (raw.tax_code ?? "IVA").toString().trim().toUpperCase();

  if (!TAX_CODES.has(taxCode)) {
    throw new FixtureValidationError(
      `Demo product ${reference} has unsupported tax_code "${raw.tax_code}". Use IVA or SIN_IVA.`,
    );
  }

  const image = raw.image;
  if (!image || typeof image !== "object") {
    throw new FixtureValidationError(
      `Demo product ${reference} image is required.`,
    );
  }

  return {
    external_id: externalId,
    name,
    description:
      typeof raw.description === "string" && raw.description.trim()
        ? raw.description.trim()
        : name,
    reference,
    category,
    tax_code: taxCode,
    cost: requireCost(raw.cost),
    image: {
      original: requireFileName(image.original, "image.original"),
      thumbnail: requireFileName(image.thumbnail, "image.thumbnail"),
      reference: requireText(image.reference, "image.reference", 100),
    },
    source_url: requireText(raw.source_url, "source_url"),
    fetched_at: requireText(raw.fetched_at, "fetched_at"),
  };
}

/**
 * Validates the complete fixture, including unique keys and the minimum size.
 * @param {object} fixture - Parsed fixture JSON.
 * @param {{ minimum?: number }} [options] - Minimum products.
 * @returns {{ products: object[] }} Normalized fixture.
 * @throws {FixtureValidationError} When the fixture is invalid.
 */
function validateFixture(fixture, { minimum = MINIMUM_PRODUCTS } = {}) {
  if (!fixture || !Array.isArray(fixture.products)) {
    throw new FixtureValidationError(
      "Demo fixture must contain a products array.",
    );
  }

  if (fixture.products.length < minimum) {
    throw new FixtureValidationError(
      `Demo fixture must contain at least ${minimum} products; found ${fixture.products.length}.`,
    );
  }

  const externalIds = new Set();
  const references = new Set();
  const products = fixture.products.map((product, index) => {
    const normalized = validateProduct(product, index);

    if (externalIds.has(normalized.external_id)) {
      throw new FixtureValidationError(
        `Demo fixture has a duplicate external_id: ${normalized.external_id}.`,
      );
    }

    if (references.has(normalized.reference)) {
      throw new FixtureValidationError(
        `Demo fixture has a duplicate reference: ${normalized.reference}.`,
      );
    }

    externalIds.add(normalized.external_id);
    references.add(normalized.reference);

    return normalized;
  });

  return { ...fixture, products };
}

module.exports = {
  COST_PATTERN,
  FixtureValidationError,
  MINIMUM_PRODUCTS,
  TAX_CODES,
  validateFixture,
  validateProduct,
};
