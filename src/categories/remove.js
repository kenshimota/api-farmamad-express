const { Router } = require("express");
const { loadCategory, handleDeleteError } = require("./shared");
const { writeAccess } = require("./guards");
const { categoryRepository } = require("./repository");

const router = Router();

/**
 * @openapi
 * /categories/{id}:
 *   delete:
 *     summary: Deletes a category permanently; only administrators and sellers can do it
 *     description: >
 *       A category referenced by a product cannot be removed: it responds 409
 *       with `Category is in use` and stays in the database.
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
 *     responses:
 *       204:
 *         description: Category deleted; the response has no body
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
 *         description: A product references the category
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *             example:
 *               message: Category is in use
 *       422:
 *         description: Invalid category id
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
router.delete("/:id", ...writeAccess(), loadCategory, async (req, res) => {
  try {
    await categoryRepository.remove(req.category);

    return res.status(204).send();
  } catch (error) {
    return handleDeleteError(error, res);
  }
});

module.exports = router;
