const { Router } = require("express");
const { readAccess } = require("./guards");
const { inboxService } = require("./service");
const { toPublicInboxLot } = require("./serializer");
const { resolveListQuery } = require("./query");

const router = Router();

/**
 * @openapi
 * /warehouse-inbox/lots:
 *   get:
 *     summary: Lists the lots waiting for a location; admin, seller and manager_warehouse
 *     description: >
 *       Returns the lots in `pending` and `in_progress` state ordered by
 *       `createdAt` and `id` ascending. Optional filters: `product_id`,
 *       `purchase_id`, `lot_number` (case-insensitive), `status`
 *       (`pending`, `in_progress`, `located` or `all`) and
 *       `expiring_before` (inclusive date). Each row includes the product,
 *       item state, purchase, purchase item, stock, reserved, `available`
 *       (0 while not located), location timestamps and audit users.
 *     tags:
 *       - Warehouse inbox
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - { in: query, name: product_id, schema: { type: integer, minimum: 1 } }
 *       - { in: query, name: purchase_id, schema: { type: integer, minimum: 1 } }
 *       - { in: query, name: lot_number, schema: { type: string, maxLength: 100 } }
 *       - { in: query, name: status, schema: { type: string, enum: [pending, in_progress, located, all] } }
 *       - { in: query, name: expiring_before, schema: { type: string, format: date } }
 *     responses:
 *       200:
 *         description: Inbox lots ordered by createdAt and id
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items: { $ref: '#/components/schemas/WarehouseInboxLot' }
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
 *         $ref: '#/components/responses/NotFound'
 *       422:
 *         description: Invalid filter
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ValidationErrors' }
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get("/lots", ...readAccess(), async (req, res) => {
  const query = resolveListQuery(req.query);

  if (query.errors) {
    return res.status(422).json({ errors: query.errors });
  }

  const lots = await inboxService.listLots(query.filters);

  return res.json(lots.map((lot) => toPublicInboxLot(lot)));
});

module.exports = router;
