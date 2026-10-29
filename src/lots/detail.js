const { Router } = require("express");
const { toPublicLot } = require("./serializer");
const { loadLot } = require("./shared");
const { readAccess } = require("./guards");

const router = Router();

/**
 * @openapi
 * /lots/{id}:
 *   get:
 *     summary: Returns one lot; admin, seller, manager_warehouse and dispatcher
 *     description: >
 *       Returns the lot with its product, item state, warehouse, shelf and
 *       section, plus `available = stock - reserved`. An invalid id answers
 *       422 and an unknown lot answers 404.
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
 *       200:
 *         description: Public lot with its nested relations
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Lot' }
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
 *       422:
 *         description: Invalid lot id
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ValidationErrors' }
 *             example: { errors: { id: Invalid lot id } }
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get("/:id", ...readAccess(), loadLot, (req, res) =>
  res.json(toPublicLot(req.lot)),
);

module.exports = router;
