const { Router } = require("express");
const { toPublicProduct } = require("./serializer");
const { normalizeProductBody, productSchema } = require("./validators");
const { ensureReferences, handleWriteError, loadProduct } = require("./shared");
const { validatedBody, writeAccess } = require("./guards");
const { productRepository } = require("./repository");
const { processUploadedImage, removeFiles } = require("./image-service");
const { requireImageSource, uploadSingleImage } = require("./upload");

const router = Router();

/**
 * @openapi
 * /products/{id}:
 *   put:
 *     summary: Updates a product; only administrators and sellers can do it
 *     description: >
 *       Replaces the resource and requires the five fields. As with every PUT
 *       endpoint, a successful update responds 202 Accepted with the updated
 *       resource in the body. The category and image must exist.
 *     tags:
 *       - Products
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *         example: 1
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
 *                 example: Ibuprofeno 800 mg
 *               description:
 *                 type: string
 *                 example: Analgésico y antiinflamatorio
 *               reference:
 *                 type: string
 *                 maxLength: 100
 *                 example: IBU-800
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
 *                 example: Ibuprofeno 800 mg
 *               description:
 *                 type: string
 *                 example: Analgésico y antiinflamatorio
 *               reference:
 *                 type: string
 *                 maxLength: 100
 *                 example: IBU-800
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
 *       202:
 *         description: Updated public product data
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
 *         description: The product does not exist
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *             example:
 *               message: Product not found
 *       409:
 *         description: The reference belongs to another product
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
 *         description: Invalid product id, fields, references or uploaded image
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ValidationErrors'
 *             example:
 *               errors:
 *                 image_id: Invalid image id
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
 * Updates the product. With an uploaded file it stores the new image and
 * replaces `image_id` in one transaction without deleting the previous row or
 * files; any failure removes the newly written files. Without a file it keeps
 * the JSON flow with `image_id`.
 * @param {import("express").Request} req - Express request.
 * @param {import("express").Response} res - Express response.
 * @returns {Promise<import("express").Response>} The updated product.
 */
async function updateProduct(req, res) {
  let generated;

  try {
    if (req.file) {
      generated = await processUploadedImage(req.file);
    }

    if (generated) {
      await productRepository.updateWithImage(
        req.product,
        generated.image,
        req.validated,
      );
    } else {
      await productRepository.update(req.product, req.validated);
    }

    return res.status(202).json(toPublicProduct(req.product));
  } catch (error) {
    if (generated) {
      await removeFiles(generated.files);
    }

    return handleWriteError(error, res);
  }
}

router.put(
  "/:id",
  ...writeAccess(),
  uploadSingleImage,
  normalizeBody,
  requireImageSource,
  ...validatedBody(productSchema),
  loadProduct,
  ensureReferences,
  updateProduct,
);

module.exports = router;
