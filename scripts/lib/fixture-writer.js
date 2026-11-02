const fs = require("fs/promises");
const path = require("path");

const TAX_CODES = new Set(["IVA", "SIN_IVA"]);

/**
 * Checks that a candidate fixture product has every required field and a valid
 * two-decimal cost.
 * @param {object} product - Candidate product.
 * @returns {boolean} True when it can be written to the fixture.
 */
function isValidProduct(product) {
  if (!product || typeof product !== "object") {
    return false;
  }

  const required = [
    product.external_id,
    product.name,
    product.reference,
    product.category,
    product.image?.original,
    product.image?.thumbnail,
    product.image?.reference,
  ];

  if (required.some((value) => typeof value !== "string" || !value.trim())) {
    return false;
  }

  if (!TAX_CODES.has(product.tax_code ?? "IVA")) {
    return false;
  }

  if (
    typeof product.cost !== "number" ||
    !Number.isFinite(product.cost) ||
    product.cost < 0 ||
    !/^\d+(\.\d{1,2})?$/.test(String(product.cost))
  ) {
    return false;
  }

  if (product.reference.length > 100) {
    return false;
  }

  return true;
}

/**
 * Filters invalid products and deduplicates by external id and reference. It
 * fails instead of replacing a fixture with too few usable rows.
 * @param {object[]} products - Candidate products.
 * @param {{ minimum?: number, limit?: number }} [options] - Collection limits.
 * @returns {object[]} Valid products.
 * @throws {Error} When fewer than the minimum survive.
 */
function collectValidProducts(products, { minimum = 100, limit = 120 } = {}) {
  const selected = [];
  const externalIds = new Set();
  const references = new Set();

  for (const product of products) {
    if (selected.length >= limit) {
      break;
    }

    if (!isValidProduct(product)) {
      continue;
    }

    const externalId = product.external_id.trim();
    const reference = product.reference.trim();

    if (externalIds.has(externalId) || references.has(reference)) {
      continue;
    }

    externalIds.add(externalId);
    references.add(reference);
    selected.push({
      ...product,
      external_id: externalId,
      name: product.name.trim(),
      reference,
      tax_code: product.tax_code ?? "IVA",
    });
  }

  if (selected.length < minimum) {
    throw new Error(
      `Scrape produced fewer than ${minimum} valid products (got ${selected.length}). The previous fixture was not modified.`,
    );
  }

  return selected;
}

/**
 * Writes a fixture through a temporary file in the same directory and renames
 * it, so a failed scrape never leaves a truncated JSON.
 * @param {string} file - Destination path.
 * @param {object} fixture - Fixture payload.
 * @param {object} [fsImpl] - File system implementation, injectable in tests.
 * @returns {Promise<void>} Resolves after the rename.
 */
async function writeFixtureAtomic(file, fixture, fsImpl = fs) {
  const directory = path.dirname(file);
  const temporary = path.join(
    directory,
    `.${path.basename(file)}.tmp-${process.pid}-${Date.now()}`,
  );
  const contents = `${JSON.stringify(fixture, null, 2)}\n`;

  await fsImpl.mkdir(directory, { recursive: true });

  try {
    await fsImpl.writeFile(temporary, contents, "utf8");
    await fsImpl.rename(temporary, file);
  } catch (error) {
    await fsImpl.unlink(temporary).catch(() => undefined);
    throw error;
  }
}

module.exports = {
  TAX_CODES,
  collectValidProducts,
  isValidProduct,
  writeFixtureAtomic,
};
