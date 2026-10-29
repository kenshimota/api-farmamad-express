const { Router } = require("express");
const { loadLot } = require("./shared");
const { writeAccess } = require("./guards");
const { lotService } = require("./service");
const { handleDeleteError } = require("./errors");

const router = Router();

/**
 * @openapi
 * /lots/{id}:
 *   delete:
 *     summary: Deletes a lot without stock or reservations; write roles
 *     description: >
 *       Only a lot with `stock = 0` and `reserved = 0` can be deleted; when it
 *       still has quantities the API answers 409 and deletes nothing. A
 *       successful delete answers 204 without body. Future rows that reference
 *       the lot are also protected by restrictive foreign keys.
 *     tags:
 *       - Lots
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer, minimum: 1 }
 *         example: 1
 *     responses:
 *       204:
 *         description: Lot deleted; the response has no body
 *       401:
 *         description: Missing, invalid or expired token
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorMessage' }
 *       403:
 *         description: Role without permission or blocked user
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorMessage' }
 *       404:
 *         description: The lot does not exist
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorMessage' }
 *             example: { message: Lot not found }
 *       409:
 *         description: The lot still has stock or reservations
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorMessage' }
 *             example: { message: Lot has stock or reservations }
 *       422:
 *         description: Invalid lot id
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ValidationErrors' }
 *             example: { errors: { id: Invalid lot id } }
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.delete("/:id", ...writeAccess(), loadLot, async (req, res) => {
  try {
    await lotService.deleteLot(req.lot);

    return res.status(204).send();
  } catch (error) {
    return handleDeleteError(error, res);
  }
});

module.exports = router;
