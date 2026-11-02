const {
  ForeignKeyConstraintError,
  UniqueConstraintError,
} = require("sequelize");
const {
  InvalidImageDimensionsError,
  InvalidImageError,
} = require("./image-errors");
const { productRepository } = require("./repository");
const {
  CATEGORY_ID_MESSAGE,
  IMAGE_ID_MESSAGE,
  TAX_ID_MESSAGE,
  normalizeProductBody,
  parseProductId,
} = require("./validators");

/**
 * Maps every product foreign key to the message returned when it is missing.
 * Both the pre-insert check and the constraint-error translation read from this
 * single registry, so adding a reference only requires one new entry.
 */
const FOREIGN_KEY_MESSAGES = Object.freeze({
  category_id: CATEGORY_ID_MESSAGE,
  image_id: IMAGE_ID_MESSAGE,
  tax_id: TAX_ID_MESSAGE,
});

const FOREIGN_KEY_FIELDS = Object.freeze(Object.keys(FOREIGN_KEY_MESSAGES));

/**
 * Ordered existence checks for the product references. The image is checked
 * last and skipped when a new file will be stored, as in the original flow.
 */
const REFERENCE_CHECKS = Object.freeze([
  {
    field: "category_id",
    exists: (id) => productRepository.categoryExists(id),
  },
  {
    field: "tax_id",
    exists: (id) => productRepository.taxExists(id),
  },
  {
    field: "image_id",
    exists: (id) => productRepository.imageExists(id),
  },
]);

/**
 * Express middleware for the routes that address a single product. It parses
 * the `:id` parameter, answers 422 when it is not a positive integer and 404
 * when the product does not exist; otherwise it exposes the loaded instance
 * as `req.product` so handlers only deal with the operation itself.
 * @param {import("express").Request} req - Express request.
 * @param {import("express").Response} res - Express response.
 * @param {import("express").NextFunction} next - Next middleware.
 * @returns {Promise<void>} Resolves after calling next or answering an error.
 */
async function loadProduct(req, res, next) {
  const id = parseProductId(req.params.id);

  if (id === null) {
    return res.status(422).json({ errors: { id: "Invalid product id" } });
  }

  const product = await productRepository.findById(id);

  if (!product) {
    return res.status(404).json({ message: "Product not found" });
  }

  req.product = product;

  return next();
}

/**
 * Express middleware that verifies the referenced category and, when no file
 * was uploaded, the referenced image before a create or update reaches the
 * database. It answers 422 with the error of the first missing field; the
 * foreign keys of the migration remain the final safeguard for concurrent
 * deletions.
 * @param {import("express").Request} req - Express request.
 * @param {import("express").Response} res - Express response.
 * @param {import("express").NextFunction} next - Next middleware.
 * @returns {Promise<void>} Resolves after calling next or answering an error.
 */
async function ensureReferences(req, res, next) {
  for (const { field, exists } of REFERENCE_CHECKS) {
    if (field === "image_id" && req.file) {
      continue;
    }

    if (!(await exists(req.validated[field]))) {
      return res
        .status(422)
        .json({ errors: { [field]: FOREIGN_KEY_MESSAGES[field] } });
    }
  }

  return next();
}

/**
 * Express middleware that normalises the numeric fields sent as text in
 * multipart requests before yup validates them.
 * @param {import("express").Request} req - Express request.
 * @param {import("express").Response} res - Express response.
 * @param {import("express").NextFunction} next - Next middleware.
 * @returns {void}
 */
function normalizeBody(req, res, next) {
  req.body = normalizeProductBody(req.body ?? {});

  return next();
}

/**
 * Reads the foreign key field named by a Sequelize constraint error. The
 * field can come as an object, an array or only inside the driver message.
 * @param {ForeignKeyConstraintError} error - Sequelize constraint error.
 * @returns {string|null} The matching field name or null.
 */
function foreignKeyField(error) {
  const fields = error.fields;
  const candidates = Array.isArray(fields) ? fields : Object.keys(fields ?? {});

  const direct = candidates.find((field) => FOREIGN_KEY_FIELDS.includes(field));

  if (direct) {
    return direct;
  }

  const message = `${error.message ?? ""} ${
    error.parent?.detail ?? ""
  }`.toLowerCase();

  return FOREIGN_KEY_FIELDS.find((field) => message.includes(field)) ?? null;
}

/**
 * Translates the image and persistence errors of the create and update
 * handlers into HTTP responses: invalid image content answers 422, a duplicated
 * reference answers 409, a foreign key violation answers 422 for the affected
 * field, and any other error is rethrown so the global error handler keeps
 * working.
 * @param {unknown} error - Error thrown by Sequelize.
 * @param {import("express").Response} res - Express response.
 * @returns {import("express").Response} The error response.
 * @throws {unknown} The original error when it cannot be classified.
 */
function handleWriteError(error, res) {
  if (error instanceof InvalidImageError) {
    return res.status(422).json({ errors: { image: "Invalid image" } });
  }

  if (error instanceof InvalidImageDimensionsError) {
    return res
      .status(422)
      .json({ errors: { image: "Invalid image dimensions" } });
  }

  if (error instanceof UniqueConstraintError) {
    return res.status(409).json({ message: "Product already exists" });
  }

  if (error instanceof ForeignKeyConstraintError) {
    const field = foreignKeyField(error);
    const message = FOREIGN_KEY_MESSAGES[field];

    if (message) {
      return res.status(422).json({ errors: { [field]: message } });
    }
  }

  throw error;
}

/**
 * Translates the persistence errors of the delete handler into HTTP responses:
 * a product referenced by another row answers 409, any other error is rethrown
 * so the global error handler keeps working.
 * @param {unknown} error - Error thrown by Sequelize.
 * @param {import("express").Response} res - Express response.
 * @returns {import("express").Response} The 409 response.
 * @throws {unknown} The original error when it is not a foreign key violation.
 */
function handleDeleteError(error, res) {
  if (error instanceof ForeignKeyConstraintError) {
    return res.status(409).json({ message: "Product is in use" });
  }

  throw error;
}

module.exports = {
  ensureReferences,
  handleDeleteError,
  handleWriteError,
  loadProduct,
  normalizeBody,
};
