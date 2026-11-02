/**
 * Error thrown when the uploaded bytes cannot be read as an allowed image
 * format. The router translates it into a 422 response with the `image` field.
 */
class InvalidImageError extends Error {
  /**
   * @param {string} [message] - Internal error message.
   */
  constructor(message = "Invalid image") {
    super(message);
    this.name = "InvalidImageError";
  }
}

/**
 * Error thrown when a valid image exceeds the accepted width, height or pixel
 * count. The router translates it into a 422 response.
 */
class InvalidImageDimensionsError extends Error {
  /**
   * @param {string} [message] - Internal error message.
   */
  constructor(message = "Invalid image dimensions") {
    super(message);
    this.name = "InvalidImageDimensionsError";
  }
}

module.exports = { InvalidImageDimensionsError, InvalidImageError };
