const crypto = require("crypto");
const fs = require("fs/promises");
const path = require("path");
const sharp = require("sharp");

const { getProductsUploadDir, getPublicBaseUrl } = require("./image-config");
const {
  InvalidImageDimensionsError,
  InvalidImageError,
} = require("./image-errors");

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const MAX_DIMENSION = 6000;
const MAX_PIXELS = 25 * 1000 * 1000;
const THUMBNAIL_SIZE = 320;
const THUMBNAIL_QUALITY = 80;

const ALLOWED_FORMATS = Object.freeze(
  new Map([
    ["jpeg", "jpg"],
    ["png", "png"],
    ["webp", "webp"],
  ]),
);

/**
 * Ensures the metadata returned by sharp fits the documented limits.
 * Missing or non-positive dimensions are rejected because the real content
 * could not be trusted.
 * @param {{ width?: number, height?: number }} metadata - Sharp metadata.
 * @returns {void}
 * @throws {InvalidImageDimensionsError} When a limit is exceeded.
 */
function validateDimensions({ width, height }) {
  if (!Number.isFinite(width) || !Number.isFinite(height)) {
    throw new InvalidImageDimensionsError();
  }

  if (width < 1 || height < 1) {
    throw new InvalidImageDimensionsError();
  }

  if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
    throw new InvalidImageDimensionsError();
  }

  if (width * height > MAX_PIXELS) {
    throw new InvalidImageDimensionsError();
  }
}

/**
 * Reads the real image metadata, ignoring the client file name and MIME type.
 * @param {Buffer} buffer - Uploaded bytes.
 * @returns {Promise<{ format: string, width: number, height: number }>}
 *   Validated metadata.
 * @throws {InvalidImageError} When the content is not a readable image.
 * @throws {InvalidImageDimensionsError} When its dimensions are out of range.
 */
async function inspectImage(buffer) {
  let metadata;

  try {
    metadata = await sharp(buffer).metadata();
  } catch (error) {
    throw new InvalidImageError();
  }

  if (!ALLOWED_FORMATS.has(metadata.format)) {
    throw new InvalidImageError();
  }

  validateDimensions(metadata);

  return metadata;
}

/**
 * Removes the files generated for an image, ignoring files that are already
 * gone. Cleanup is best-effort so it never masks the original failure.
 * @param {string[]} files - Absolute file paths.
 * @returns {Promise<void>} Resolves once every path was processed.
 */
async function removeFiles(files = []) {
  await Promise.all(
    files.map((file) => fs.unlink(file).catch(() => undefined)),
  );
}

/**
 * Validates an uploaded file, writes the original with a UUID name and creates
 * a WebP thumbnail next to it. The returned attributes are ready for the
 * `images` table.
 * @param {{ buffer?: Buffer }} file - Multer in-memory file.
 * @returns {Promise<{ image: { reference: string, pathname: string,
 *   url: string, thumbnail: string }, files: string[] }>} Stored image data.
 * @throws {InvalidImageError} When the content is not JPEG, PNG or WebP.
 * @throws {InvalidImageDimensionsError} When the dimensions are out of range.
 */
async function processUploadedImage(file) {
  const buffer = file && file.buffer;

  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw new InvalidImageError();
  }

  const metadata = await inspectImage(buffer);
  const extension = ALLOWED_FORMATS.get(metadata.format);
  const uuid = crypto.randomUUID();
  const filename = `${uuid}.${extension}`;
  const thumbnailName = `${uuid}-thumb.webp`;
  const folder = getProductsUploadDir();
  const originalPath = path.join(folder, filename);
  const thumbnailPath = path.join(folder, thumbnailName);

  await fs.mkdir(folder, { recursive: true });

  try {
    await fs.writeFile(originalPath, buffer);
  } catch (error) {
    await removeFiles([originalPath]);
    throw error;
  }

  try {
    await sharp(buffer)
      .resize({
        width: THUMBNAIL_SIZE,
        height: THUMBNAIL_SIZE,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: THUMBNAIL_QUALITY })
      .toFile(thumbnailPath);
  } catch (error) {
    // The header was readable but the pixels were not: corrupt content.
    await removeFiles([originalPath, thumbnailPath]);
    throw new InvalidImageError();
  }

  const baseUrl = getPublicBaseUrl();
  const pathname = `/uploads/products/${filename}`;

  return {
    image: {
      reference: `product-${uuid}`,
      pathname,
      url: `${baseUrl}${pathname}`,
      thumbnail: `${baseUrl}/uploads/products/${thumbnailName}`,
    },
    files: [originalPath, thumbnailPath],
  };
}

module.exports = {
  MAX_DIMENSION,
  MAX_PIXELS,
  MAX_UPLOAD_BYTES,
  THUMBNAIL_QUALITY,
  THUMBNAIL_SIZE,
  processUploadedImage,
  removeFiles,
  validateDimensions,
};
