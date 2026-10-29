const { Router } = require("express");
const { toPublicPurchase } = require("./serializer");
const { writeAccess } = require("./guards");
const { purchaseService } = require("./purchase-service");
const { handlePurchaseError } = require("./shared");
const { parsePurchaseId } = require("./parsers");

const router = Router();

/**
 * @openapi
 * /purchases/{id}/confirm:
 *   post:
 *     summary: Confirms a draft purchase; only administrators and sellers can do it
 *     description: >
 *       In one transaction recalculates the totals, upserts the current
 *       `costs` of every line (inheriting `purchase.currency_id`), increments
 *       `stocks` and sets `confirmed` plus `confirmed_at`. No amount is
 *       converted. A purchase without lines answers 422 and any failure
 *       rolls back costs and stocks. Confirming twice answers 409 and is not
 *       idempotent by design.
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
 *         description: Confirmed purchase with its items and supplier
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
 *         description: Already confirmed or not editable
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorMessage' }
 *       422:
 *         description: Purchase has no items or references no longer exist
 *         content:
 *           application/json:
 *             schema:
 *               oneOf:
 *                 - $ref: '#/components/schemas/ValidationErrors'
 *                 - $ref: '#/components/schemas/ErrorMessage'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post("/:id/confirm", ...writeAccess(), async (req, res) => {
  const id = parsePurchaseId(req.params.id);

  if (id === null) {
    return res.status(422).json({ errors: { id: "Invalid purchase id" } });
  }

  try {
    const purchase = await purchaseService.confirmPurchase(id);

    return res.json(
      toPublicPurchase(purchase, {
        includeItems: true,
        includeSupplier: true,
      }),
    );
  } catch (error) {
    return handlePurchaseError(error, res);
  }
});

module.exports = router;
