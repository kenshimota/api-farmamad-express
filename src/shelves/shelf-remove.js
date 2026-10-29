const { Router } = require("express");
const { loadShelf } = require("./shared");
const { writeAccess } = require("./guards");
const { shelfService } = require("./shelf-service");
const { handleShelfDeleteError } = require("./errors");

const router = Router();

/**
 * @openapi
 * /shelves/{id}:
 *   delete:
 *     summary: Deletes a shelf; admin and manager_warehouse
 *     description: >
 *       Deletes the shelf and, in cascade, its sections. When any lot of HU-24
 *       references the shelf or one of its sections the API answers 409
 *       `Shelf has lots` and deletes nothing. A successful delete responds 204
 *       without body.
 *     tags:
 *       - Shelves
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
 *         description: Shelf deleted; the response has no body
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
 *         description: The shelf does not exist
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorMessage' }
 *             example: { message: Shelf not found }
 *       409:
 *         description: Lots still reference the shelf or one of its sections
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorMessage' }
 *             example: { message: Shelf has lots }
 *       422:
 *         description: Invalid shelf id
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ValidationErrors' }
 *             example: { errors: { id: Invalid shelf id } }
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.delete("/:id", ...writeAccess(), loadShelf, async (req, res) => {
  try {
    await shelfService.deleteShelf(req.shelf);

    return res.status(204).send();
  } catch (error) {
    return handleShelfDeleteError(error, res);
  }
});

module.exports = router;
