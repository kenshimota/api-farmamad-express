const fs = require("fs/promises");
const path = require("path");
const sharp = require("sharp");
const { getUploadDir } = require("../../../src/products/image-config");

const THUMBNAIL_MAX_WIDTH = 320;

/**
 * Lists the image files of a product with their fixture field name.
 * @param {object} product - Fixture product.
 * @returns {Array<[string, string]>} Field and file name pairs.
 */
function imageFiles(product) {
  return [
    ["original", product.image.original],
    ["thumbnail", product.image.thumbnail],
  ];
}

/**
 * Validates one versioned asset and fails with a message that names the
 * product, the field and the path.
 * @param {object} product - Fixture product.
 * @param {string} field - Image field.
 * @param {string} filePath - Absolute asset path.
 * @returns {Promise<void>} Resolves when the asset is valid.
 * @throws {Error} When the asset is missing, corrupt or not WebP.
 */
async function assertImage(product, field, filePath) {
  let metadata;

  try {
    metadata = await sharp(filePath).metadata();
  } catch (error) {
    throw new Error(
      `Demo image ${field} for ${product.reference} is missing or not a valid image: ${filePath}. Restore the versioned asset or run "npm run seed:scrape".`,
    );
  }

  if (metadata.format !== "webp") {
    throw new Error(
      `Demo image ${field} for ${product.reference} must be WebP; found ${metadata.format} at ${filePath}.`,
    );
  }

  if (field === "thumbnail" && metadata.width > THUMBNAIL_MAX_WIDTH) {
    throw new Error(
      `Demo thumbnail for ${product.reference} must be at most ${THUMBNAIL_MAX_WIDTH} px wide; found ${metadata.width}.`,
    );
  }
}

/**
 * Copies one asset unless the destination already exists.
 * @param {string} source - Versioned asset path.
 * @param {string} target - Public upload path.
 * @returns {Promise<void>} Resolves after the check or copy.
 */
async function copyAsset(source, target) {
  try {
    await fs.access(target);
  } catch (error) {
    await fs.copyFile(source, target);
  }
}

/**
 * Validates that every fixture image exists and that sharp can decode it. The
 * seed fails instead of creating a product with a missing or corrupt image.
 * @param {object[]} products - Validated fixture products.
 * @param {string} assetsDir - Folder with the versioned assets.
 * @returns {Promise<void>} Resolves when every asset is valid.
 * @throws {Error} When an asset is missing, corrupt or not WebP.
 */
async function assertDemoAssets(products, assetsDir) {
  for (const product of products) {
    for (const [field, file] of imageFiles(product)) {
      await assertImage(product, field, path.join(assetsDir, file));
    }
  }
}

/**
 * Copies the versioned assets to the public upload folder, without overwriting
 * files that are already there and without any network access.
 * @param {object[]} products - Validated fixture products.
 * @param {string} assetsDir - Folder with the versioned assets.
 * @returns {Promise<string>} The demo upload folder.
 */
async function copyDemoAssets(products, assetsDir) {
  const directory = path.join(getUploadDir(), "products", "demo");
  await fs.mkdir(directory, { recursive: true });

  for (const product of products) {
    for (const [, file] of imageFiles(product)) {
      await copyAsset(path.join(assetsDir, file), path.join(directory, file));
    }
  }

  return directory;
}

module.exports = { assertDemoAssets, copyDemoAssets };
