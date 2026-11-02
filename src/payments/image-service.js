const path = require("path");
const {
  getPaymentsUploadDir,
  processUploadedImage: processSharedImage,
  removeFiles,
} = require("../shared/image-service");

const PAYMENT_IMAGE_PREFIX = "payment-reference";
const PAYMENT_IMAGE_PUBLIC_PATH = "/uploads/payments";

/**
 * Validates and stores one payment reference image under `uploads/payments`,
 * reusing the shared sharp pipeline from the products module.
 * @param {{ buffer?: Buffer }} file - Multer in-memory file.
 * @returns {Promise<{ image: { reference: string, pathname: string,
 *   url: string, thumbnail: string }, files: string[] }>} Stored image data.
 */
function processPaymentImage(file) {
  return processSharedImage(file, {
    folder: getPaymentsUploadDir(),
    pathname: PAYMENT_IMAGE_PUBLIC_PATH,
    referencePrefix: PAYMENT_IMAGE_PREFIX,
  });
}

/**
 * Builds the on-disk paths of a stored payment image from its public pathname.
 * @param {object} image - Stored image row.
 * @returns {string[]} The original and thumbnail paths.
 */
function getPaymentImageFiles(image) {
  const pathname =
    typeof image?.get === "function" ? image.get("pathname") : image?.pathname;

  if (!pathname) {
    return [];
  }

  const folder = getPaymentsUploadDir();
  const original = path.join(folder, path.basename(pathname));
  const thumbnail = path.join(
    folder,
    `${path.basename(pathname, path.extname(pathname))}-thumb.webp`,
  );

  return [original, thumbnail];
}

/**
 * Removes the original and thumbnail of a payment image. Cleanup is
 * best-effort so a missing file never masks the request result.
 * @param {object} image - Stored image row.
 * @returns {Promise<void>} Resolves once every path was processed.
 */
async function removePaymentImageFiles(image) {
  await removeFiles(getPaymentImageFiles(image));
}

module.exports = {
  PAYMENT_IMAGE_PREFIX,
  PAYMENT_IMAGE_PUBLIC_PATH,
  getPaymentImageFiles,
  processPaymentImage,
  removePaymentImageFiles,
};
