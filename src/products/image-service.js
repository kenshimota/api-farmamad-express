const {
  MAX_DIMENSION,
  MAX_PIXELS,
  MAX_UPLOAD_BYTES,
  THUMBNAIL_QUALITY,
  THUMBNAIL_SIZE,
  getProductsUploadDir,
  inspectImage,
  processUploadedImage: processSharedImage,
  removeFiles,
  validateDimensions,
} = require("../shared/image-service");

/**
 * Validates and stores one product image, reusing the shared sharp pipeline.
 * @param {{ buffer?: Buffer }} file - Multer in-memory file.
 * @returns {Promise<{ image: { reference: string, pathname: string,
 *   url: string, thumbnail: string }, files: string[] }>} Stored image data.
 */
function processUploadedImage(file) {
  return processSharedImage(file, {
    folder: getProductsUploadDir(),
    pathname: "/uploads/products",
    referencePrefix: "product",
  });
}

module.exports = {
  MAX_DIMENSION,
  MAX_PIXELS,
  MAX_UPLOAD_BYTES,
  THUMBNAIL_QUALITY,
  THUMBNAIL_SIZE,
  inspectImage,
  processUploadedImage,
  removeFiles,
  validateDimensions,
};
