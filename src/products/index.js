const { Router } = require("express");
const { toPublicProduct } = require("./serializer");
const { productSchema } = require("./validators");
const { validatedBody, writeAccess } = require("./guards");
const { productRepository } = require("./repository");
const { ensureReferences, handleWriteError } = require("./shared");
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
 *               - image_id
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
 *                 example: 1
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
 *         $ref: '#/components/responses/NotFound'
 *       409:
 *         description: The product reference already exists
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *             example:
 *               message: Product already exists
 *       422:
 *         description: Invalid fields or non-existent category/image
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
router.post(
  "/",
  ...writeAccess(),
  ...validatedBody(productSchema),
  ensureReferences,
  async (req, res) => {
    try {
      const product = await productRepository.create(req.validated);

      return res.status(201).json(toPublicProduct(product));
    } catch (error) {
      return handleWriteError(error, res);
    }
  },
);

router.use(listRouter);
router.use(updateRouter);
router.use(removeRouter);

module.exports = router;
