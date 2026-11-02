const multer = require("multer");

const {
  IMAGE_ID_EXCLUSIVE_MESSAGE,
  IMAGE_REQUIRED_MESSAGE,
} = require("./validators");

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const FILE_FIELD = "image";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_UPLOAD_BYTES,
    files: 1,
  },
});

/**
 * Tells whether the body carries a usable `image_id`.
 * @param {object} body - Request body.
 * @returns {boolean} True when the field is present and not blank.
 */
function hasImageId(body = {}) {
  const value = body.image_id;

  return value !== undefined && value !== null && String(value).trim() !== "";
}

/**
 * Parses `multipart/form-data` with multer in memory and translates the multer
 * errors into the products contract: an oversized file answers 413, any other
 * multer failure (unexpected field, too many files) answers 400. Non-multipart
 * requests simply continue so the JSON flow keeps working.
 * @param {import("express").Request} req - Express request.
 * @param {import("express").Response} res - Express response.
 * @param {import("express").NextFunction} next - Next middleware.
 * @returns {void}
 */
function uploadSingleImage(req, res, next) {
  upload.single(FILE_FIELD)(req, res, (error) => {
    if (!error) {
      return next();
    }

    if (error instanceof multer.MulterError) {
      if (error.code === "LIMIT_FILE_SIZE") {
        return res.status(413).json({ message: "Image too large" });
      }

      return res.status(400).json({ message: "Unexpected field" });
    }

    return next(error);
  });
}

/**
 * Enforces the image source contract before validating the text fields: a
 * request must send either a file or an `image_id`, never both.
 * @param {import("express").Request} req - Express request.
 * @param {import("express").Response} res - Express response.
 * @param {import("express").NextFunction} next - Next middleware.
 * @returns {void}
 */
function requireImageSource(req, res, next) {
  const body = req.body ?? {};
  const hasFile = Boolean(req.file);
  const hasId = hasImageId(body);

  if (hasFile && hasId) {
    return res.status(422).json({
      errors: { image_id: IMAGE_ID_EXCLUSIVE_MESSAGE },
    });
  }

  if (!hasFile && !hasId) {
    return res.status(400).json({ message: IMAGE_REQUIRED_MESSAGE });
  }

  return next();
}

module.exports = {
  FILE_FIELD,
  MAX_UPLOAD_BYTES,
  requireImageSource,
  uploadSingleImage,
};
