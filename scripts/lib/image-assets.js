const fs = require("fs/promises");
const path = require("path");
const sharp = require("sharp");

const PROCESSED_ORIGINAL_MAX = 800;
const PROCESSED_ORIGINAL_QUALITY = 82;
const THUMBNAIL_SIZE = 320;
const THUMBNAIL_QUALITY = 80;

/**
 * Decodes image metadata. The file extension is never trusted; content that
 * cannot be decoded is rejected with an actionable message.
 * @param {string|Buffer} input - Image path or downloaded bytes.
 * @param {string} label - Error prefix that names the image source.
 * @returns {Promise<object>} Sharp metadata.
 * @throws {Error} When the content is not a readable image.
 */
async function readImageMetadata(input, label) {
  let metadata;

  try {
    metadata = await sharp(input).metadata();
  } catch (error) {
    throw new Error(`${label}: ${error.message}`);
  }

  if (!metadata.format || !metadata.width || !metadata.height) {
    throw new Error(`${label}.`);
  }

  return metadata;
}

/**
 * Writes one resized WebP file, creating its parent folder first.
 * @param {Buffer} buffer - Source image bytes.
 * @param {string} output - Destination path.
 * @param {{ size: number, quality: number }} options - Resize settings.
 * @returns {Promise<void>} Resolves after the file is written.
 */
async function writeWebp(buffer, output, { size, quality }) {
  await fs.mkdir(path.dirname(output), { recursive: true });

  await sharp(buffer)
    .rotate()
    .resize({
      width: size,
      height: size,
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality })
    .toFile(output);
}

/**
 * Reads the real metadata of a stored image. The file extension is never
 * trusted; content that cannot be decoded is rejected.
 * @param {string} file - Absolute image path.
 * @returns {Promise<object>} Sharp metadata.
 * @throws {Error} When the file is missing or not a readable image.
 */
function validateImageAsset(file) {
  return readImageMetadata(file, `Asset ${file} is not a valid image`);
}

/**
 * Validates the downloaded bytes with sharp, converts them to an optimized
 * WebP original and generates a 320 px WebP thumbnail.
 * @param {Buffer} buffer - Downloaded image bytes.
 * @param {{ originalPath: string, thumbnailPath: string }} paths - Destinations.
 * @returns {Promise<object>} Metadata of the processed original.
 * @throws {Error} When the content is not a real image.
 */
async function processProductImage(buffer, { originalPath, thumbnailPath }) {
  const metadata = await readImageMetadata(
    buffer,
    "Downloaded content is not a valid image",
  );

  await writeWebp(buffer, originalPath, {
    size: PROCESSED_ORIGINAL_MAX,
    quality: PROCESSED_ORIGINAL_QUALITY,
  });
  await writeWebp(buffer, thumbnailPath, {
    size: THUMBNAIL_SIZE,
    quality: THUMBNAIL_QUALITY,
  });

  return metadata;
}

module.exports = {
  PROCESSED_ORIGINAL_MAX,
  PROCESSED_ORIGINAL_QUALITY,
  THUMBNAIL_QUALITY,
  THUMBNAIL_SIZE,
  processProductImage,
  validateImageAsset,
};
