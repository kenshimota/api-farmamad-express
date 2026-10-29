const { Router } = require("express");
const { loadItemState, handleDeleteError } = require("./shared");
const { writeAccess } = require("./guards");
const { itemStateRepository } = require("./repository");

const router = Router();

/**
 * @openapi
 * /item-states/{id}:
 *   delete:
 *     summary: Deletes an item state permanently; only administrators and sellers can do it
 *     description: >
 *       An item state referenced by costs, stocks or purchase items cannot be
 *       removed: it responds 409 with `Item state is in use` and stays in the
 *       database. Costs and stocks are checked before deleting; the
 *       restrictive foreign keys remain the final safeguard for concurrent
 *       deletions and purchase items (HU-21).
 *     tags:
 *       - Item states
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
 *         description: Item state deleted; the response has no body
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
 *         description: The item state does not exist
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *             example:
 *               message: Item state not found
 *       409:
 *         description: Costs, stocks or purchase items reference the item state
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *             example:
 *               message: Item state is in use
 *       422:
 *         description: Invalid item state id
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ValidationErrors'
 *             example:
 *               errors:
 *                 id: Invalid item state id
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.delete("/:id", ...writeAccess(), loadItemState, async (req, res) => {
  try {
    if (await itemStateRepository.isReferenced(req.item_state.id)) {
      return res.status(409).json({ message: "Item state is in use" });
    }

    await itemStateRepository.remove(req.item_state);

    return res.status(204).send();
  } catch (error) {
    return handleDeleteError(error, res);
  }
});

module.exports = router;
