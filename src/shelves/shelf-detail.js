const { Router } = require("express");
const { toPublicShelf } = require("./serializer");
const { loadShelf } = require("./shared");
const { readAccess } = require("./guards");

const router = Router();

/**
 * @openapi
 * /shelves/{id}:
 *   get:
 *     summary: Returns one shelf with its sections; read roles
 *     description: >
 *       Returns the shelf and its `sections` ordered by code. An invalid id
 *       answers 422 and an unknown shelf answers 404.
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
 *       200:
 *         description: Public shelf with its sections
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Shelf' }
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
 *       422:
 *         description: Invalid shelf id
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ValidationErrors' }
 *             example: { errors: { id: Invalid shelf id } }
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get("/:id", ...readAccess(), loadShelf, (req, res) =>
  res.json(toPublicShelf(req.shelf, { includeSections: true })),
);

module.exports = router;
