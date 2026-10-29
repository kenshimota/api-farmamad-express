const { Router } = require("express");
const { toPublicLot } = require("./serializer");
const { loadLot } = require("./shared");
const { REQUIRED_UPDATE_FIELDS, updateLotSchema } = require("./validators");
const { validatedBody, writeAccess } = require("./guards");
const { lotService } = require("./service");
const { handleWriteError } = require("./errors");

const router = Router();

/**
 * @openapi
 * /lots/{id}:
 *   put:
 *     summary: Replaces the editable fields of a lot; write roles
 *     description: >
 *       Requires `number`, `product_id`, `expiration_date`, `item_state_id`,
 *       `stock`, `reserved`, `warehouse_id`, `shelf_id` and `section_id`.
 *       References and location coherence are revalidated, `reserved` cannot
 *       exceed `stock` and the new `(product_id, number)` pair must stay
 *       unique. `id`, `available` and the audit timestamps are ignored. A
 *       successful update answers 202 with `available = stock - reserved`.
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
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - number
 *               - product_id
 *               - expiration_date
 *               - item_state_id
 *               - stock
 *               - reserved
 *               - warehouse_id
 *               - shelf_id
 *               - section_id
 *             properties:
 *               number: { type: string, maxLength: 100, example: L-2026-001 }
 *               product_id: { type: integer, minimum: 1, example: 15 }
 *               expiration_date: { type: string, format: date, example: '2027-03-31' }
 *               item_state_id: { type: integer, minimum: 1, example: 1 }
 *               stock: { type: integer, minimum: 0, maximum: 1000000000, example: 100 }
 *               reserved: { type: integer, minimum: 0, maximum: 1000000000, example: 10 }
 *               warehouse_id: { type: integer, minimum: 1, example: 1 }
 *               shelf_id: { type: integer, minimum: 1, example: 1 }
 *               section_id: { type: integer, minimum: 1, example: 2 }
 *     responses:
 *       202:
 *         description: Updated lot
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Lot' }
 *       400:
 *         description: Missing required fields
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorMessage' }
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
 *         description: The new pair belongs to another lot
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorMessage' }
 *             example: { message: Lot already exists }
 *       422:
 *         description: Invalid fields, references, location or quantities
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ValidationErrors' }
 *             example: { errors: { reserved: reserved cannot exceed stock } }
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.put(
  "/:id",
  ...writeAccess(),
  ...validatedBody(updateLotSchema, [...REQUIRED_UPDATE_FIELDS]),
  loadLot,
  async (req, res) => {
    try {
      const lot = await lotService.updateLot(req.lot, req.validated);

      return res.status(202).json(toPublicLot(lot));
    } catch (error) {
      return handleWriteError(error, res);
    }
  },
);

module.exports = router;
