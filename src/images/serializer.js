/**
 * Reads a field from a Sequelize instance or a plain object.
 * @param {object} image - Sequelize instance or plain object.
 * @param {string} field - Field name.
 * @returns {unknown} The raw value.
 */
function readField(image, field) {
  return typeof image.get === "function" ? image.get(field) : image[field];
}

/**
 * Builds the public representation of an image: only `id`, `url`, `pathname`,
 * `reference` and `thumbnail`, with no audit columns or internal fields.
 * @param {object} image - Image instance or plain object.
 * @returns {{ id: number, url: string, pathname: string|null, reference: string,
 *   thumbnail: string }} Public data.
 */
function toPublicImage(image) {
  return {
    id: readField(image, "id"),
    url: readField(image, "url"),
    pathname: readField(image, "pathname"),
    reference: readField(image, "reference"),
    thumbnail: readField(image, "thumbnail"),
  };
}

module.exports = { toPublicImage };
