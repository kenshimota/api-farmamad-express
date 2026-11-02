/**
 * Builds the image attributes persisted for a processed upload.
 * @param {object} processed - Result of the image processor.
 * @returns {object} Attributes for the images table.
 */
function imageAttributes(processed) {
  return {
    reference: processed.image.reference,
    pathname: processed.image.pathname,
    url: processed.image.url,
    thumbnail: processed.image.thumbnail,
  };
}

/**
 * Validates and stores one reference image inside an open transaction.
 * @param {object} repository - Payment repository.
 * @param {function(object): Promise<object>} imageProcessor - Image processor.
 * @param {object} file - Multer in-memory image.
 * @param {object} options - Sequelize options with the transaction.
 * @returns {Promise<{ referenceImageId: number, files: string[] }>} The new
 *   image id and the files that must be removed if the transaction rolls back.
 */
async function storeReferenceImage(repository, imageProcessor, file, options) {
  const processed = await imageProcessor(file);
  const image = await repository.createImage(
    imageAttributes(processed),
    options,
  );

  return {
    referenceImageId: image.id,
    files: processed.files ?? [],
  };
}

module.exports = {
  imageAttributes,
  storeReferenceImage,
};
