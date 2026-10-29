const { Router } = require("express");
const { toPublicCategory } = require("./serializer");
const { categorySchema } = require("./validators");
const { loadCategory, handleWriteError } = require("./shared");
const { validatedBody, writeAccess } = require("./guards");
const { categoryRepository } = require("./repository");

const router = Router();

/**
 * @openapi
 * /categories/{id}:
 *   put:
 *     summary: Updates a category; only administrators and sellers can do it
 *     description: >
 *       Replaces the resource and requires `name`. As with every PUT endpoint,
 *       a successful update responds 202 Accepted with the updated resource in
 *       the body.
 *     tags:
 *       - Categories
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
 *             properties:
 *               name:
 *                 type: string
 *                 maxLength: 100
 *                 example: Antiinflamatorios
 *     responses:
 *       202:
 *         description: Updated public category data
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Category'
 *       400:
 *         description: Missing required fields
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *             example:
 *               message: name is required
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
 *         description: The category does not exist
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *             example:
 *               message: Category not found
 *       409:
 *         description: The category name belongs to another category
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *             example:
 *               message: Category already exists
 *       422:
 *         description: Invalid category id or fields
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ValidationErrors'
 *             example:
 *               errors:
 *                 id: Invalid category id
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.put(
  "/:id",
  ...writeAccess(),
  ...validatedBody(categorySchema),
  loadCategory,
  async (req, res) => {
    try {
      await categoryRepository.update(req.category, req.validated);

      return res.status(202).json(toPublicCategory(req.category));
    } catch (error) {
      return handleWriteError(error, res);
    }
  },
);

module.exports = router;
