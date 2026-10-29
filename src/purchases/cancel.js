const { Router } = require("express");
const { toPublicPurchase } = require("./serializer");
const { writeAccess } = require("./guards");
const { purchaseService } = require("./purchase-service");
const { handlePurchaseError } = require("./shared");
const { parsePurchaseId } = require("./parsers");

const router = Router();

/**
 * @openapi
 * /purchases/{id}/cancel:
 *   post:
 *     summary: Cancels a draft purchase; only administrators and sellers can do it
 *     description: >
 *       Changes `draft` to `cancelled` and responds 200 without touching
 *       `costs` or `stocks`. Confirmed purchases are immutable and answer 409
 *       with `Purchase is not editable`.
 *     tags:
 *       - Purchases
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer, minimum: 1 }
 *     responses:
 *       200:
 *         description: Cancelled purchase with its items
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/PurchaseDetail' }
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
 *         description: The purchase does not exist
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorMessage' }
 *       409:
 *         description: Purchase is not editable
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorMessage' }
 *       422:
 *         description: Invalid purchase id
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ValidationErrors' }
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post("/:id/cancel", ...writeAccess(), async (req, res) => {
  const id = parsePurchaseId(req.params.id);

  if (id === null) {
    return res.status(422).json({ errors: { id: "Invalid purchase id" } });
  }

  try {
    const purchase = await purchaseService.cancelPurchase(id);

    return res.json(toPublicPurchase(purchase, { includeItems: true }));
  } catch (error) {
    return handlePurchaseError(error, res);
  }
});

module.exports = router;
