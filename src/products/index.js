const { Router } = require("express");
const { toPublicProduct } = require("./serializer");
const { normalizeProductBody, productSchema } = require("./validators");
const { validatedBody, writeAccess } = require("./guards");
const { productRepository } = require("./repository");
const { ensureReferences, handleWriteError } = require("./shared");
const { processUploadedImage, removeFiles } = require("./image-service");
const { requireImageSource, uploadSingleImage } = require("./upload");
const listRouter = require("./list");
const updateRouter = require("./update");
const removeRouter = require("./remove");

const router = Router();

/**
 * @openapi
 * /products:
 *   post:
 *     summary: Creates a product; only administrators and sellers can do it
 *     description: >
 *       Persists a catalog product linked to an existing category and image.
 *       `name`, `description` and `reference` are stored trimmed; `reference`
 *       is unique. Both foreign keys are verified before inserting and keep
 *       their referential integrity at the database level.
 *     tags:
 *       - Products
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - description
 *               - reference
 *               - category_id
 *             properties:
 *               name:
 *                 type: string
 *                 maxLength: 150
 *                 example: Ibuprofeno 400 mg
 *               description:
 *                 type: string
 *                 example: Analgésico y antiinflamatorio
 *               reference:
 *                 type: string
 *                 maxLength: 100
 *                 description: Unique product reference; it is stored trimmed
 *                 example: IBU-400
 *               category_id:
 *                 type: integer
 *                 minimum: 1
 *                 example: 1
 *               image_id:
 *                 type: integer
 *                 minimum: 1
 *                 description: Existing image id; it cannot be combined with `image`
 *                 example: 1
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - description
 *               - reference
 *               - category_id
 *             properties:
 *               name:
 *                 type: string
 *                 maxLength: 150
 *                 example: Ibuprofeno 400 mg
 *               description:
 *                 type: string
 *                 example: Analgésico y antiinflamatorio
 *               reference:
 *                 type: string
 *                 maxLength: 100
 *                 example: IBU-400
 *               category_id:
 *                 type: integer
 *                 minimum: 1
 *                 example: 1
 *               image_id:
 *                 type: integer
 *                 minimum: 1
 *                 description: Existing image id; it cannot be combined with `image`
 *                 example: 1
 *               image:
 *                 type: string
 *                 format: binary
 *                 description: JPEG, PNG or WebP file up to 5 MB
 *     responses:
 *       201:
 *         description: Product created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Product'
 *       400:
 *         description: Missing required fields
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *             example:
 *               message: image or image_id is required
 *       401:
 *         description: Missing, invalid or expired token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *             example:
 *               message: Unauthorized
 *       403:
 *         description: Role without permission or blocked user
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *             example:
 *               message: Forbidden
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       409:
 *         description: The product reference already exists
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *             example:
 *               message: Product already exists
 *       413:
 *         description: Uploaded image exceeds 5 MB
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *             example:
 *               message: Image too large
 *       422:
 *         description: Invalid fields, category/image or uploaded image content
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ValidationErrors'
 *             example:
 *               errors:
 *                 category_id: Invalid category id
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
/**
 * Normalises the numeric fields that arrive as text in multipart requests
 * before yup validates them.
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
 * Creates the product. With an uploaded file it stores the original and the
 * thumbnail, creates the image row and links the product in one transaction;
 * any failure removes the written files. Without a file it keeps the JSON flow
 * with `image_id`.
 * @param {import("express").Request} req - Express request.
 * @param {import("express").Response} res - Express response.
 * @returns {Promise<import("express").Response>} The created product.
 */
async function createProduct(req, res) {
  let generated;

  try {
    if (req.file) {
      generated = await processUploadedImage(req.file);
    }

    const product = generated
      ? await productRepository.createWithImage(generated.image, req.validated)
      : await productRepository.create(req.validated);

    return res.status(201).json(toPublicProduct(product));
  } catch (error) {
    if (generated) {
      await removeFiles(generated.files);
    }

    return handleWriteError(error, res);
  }
}

router.post(
  "/",
  ...writeAccess(),
  uploadSingleImage,
  normalizeBody,
  requireImageSource,
  ...validatedBody(productSchema),
  ensureReferences,
  createProduct,
);

router.use(listRouter);
router.use(updateRouter);
router.use(removeRouter);

module.exports = router;
