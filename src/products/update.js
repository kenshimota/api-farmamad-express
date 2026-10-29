const { Router } = require("express");
const { toPublicProduct } = require("./serializer");
const { productSchema } = require("./validators");
const { ensureReferences, handleWriteError, loadProduct } = require("./shared");
const { validatedBody, writeAccess } = require("./guards");
const { productRepository } = require("./repository");

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
 *               - image_id
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
 *                 example: 1
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
 *               message: name, description, reference, category_id and image_id are required
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
 *       422:
 *         description: Invalid product id, fields or references
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
router.put(
  "/:id",
  ...writeAccess(),
  ...validatedBody(productSchema),
  loadProduct,
  ensureReferences,
  async (req, res) => {
    try {
      await productRepository.update(req.product, req.validated);

      return res.status(202).json(toPublicProduct(req.product));
    } catch (error) {
      return handleWriteError(error, res);
    }
  },
);

module.exports = router;
