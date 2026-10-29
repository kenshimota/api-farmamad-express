const { Router } = require("express");
const { handleDeleteError, loadCost } = require("./shared");
const { writeAccess } = require("./guards");
const { costRepository } = require("./repository");

const router = Router();

/**
 * @openapi
 * /costs/{id}:
 *   delete:
 *     summary: Deletes a cost permanently; only administrators and sellers can do it
 *     description: >
 *       Removes the current cost of a product for an item state. It does not
 *       touch the products, the item states, the purchase items or the stocks.
 *     tags:
 *       - Costs
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
 *         description: Cost deleted; the response has no body
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
 *         description: The cost does not exist
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *             example:
 *               message: Cost not found
 *       409:
 *         description: Another row references the cost
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *             example:
 *               message: Cost is in use
 *       422:
 *         description: Invalid cost id
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ValidationErrors'
 *             example:
 *               errors:
 *                 id: Invalid cost id
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.delete("/:id", ...writeAccess(), loadCost, async (req, res) => {
  try {
    await costRepository.remove(req.cost);

    return res.status(204).send();
  } catch (error) {
    return handleDeleteError(error, res);
  }
});

module.exports = router;
