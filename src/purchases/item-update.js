const { Router } = require("express");
const { toPublicPurchase } = require("./serializer");
const {
  EDITABLE_PURCHASE_ITEM_FIELDS,
  updatePurchaseItemSchema,
} = require("./validators");
const { requireAnyField, validatedBody, writeAccess } = require("./guards");
const { purchaseService } = require("./purchase-service");
const { handlePurchaseError } = require("./shared");
const {
  itemIdOrRespond,
  purchaseIdOrRespond,
} = require("./item-router-shared");

const router = Router();

/**
 * @openapi
 * /purchases/{purchase_id}/items/{item_id}:
 *   put:
 *     summary: Updates a line of a draft purchase
 *     description: >
 *       Accepts any of `product_id`, `item_state_id`, `quantity` and
 *       `unit_cost`, recalculates the purchase and responds 202 with the
 *       updated purchase and its lines.
 *     tags: [Purchases]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: purchase_id
 *         required: true
 *         schema: { type: integer, minimum: 1 }
 *       - in: path
 *         name: item_id
 *         required: true
 *         schema: { type: integer, minimum: 1 }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/PurchaseItemUpdate' }
 *     responses:
 *       202:
 *         description: Updated purchase with its lines
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/PurchaseDetail' }
 *       400:
 *         description: No field was provided
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
 *         description: Purchase or item does not exist
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorMessage' }
 *       409:
 *         description: Item already exists or purchase is not editable
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorMessage' }
 *       422:
 *         description: Invalid ids or fields
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ValidationErrors' }
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.put(
  "/:purchase_id/items/:item_id",
  ...writeAccess(),
  ...validatedBody(updatePurchaseItemSchema, []),
  requireAnyField(
    [...EDITABLE_PURCHASE_ITEM_FIELDS],
    "At least one field is required",
  ),
  async (req, res) => {
    const purchaseId = purchaseIdOrRespond(req, res);

    if (purchaseId === null) {
      return undefined;
    }

    const itemId = itemIdOrRespond(req, res);

    if (itemId === null) {
      return undefined;
    }

    try {
      const purchase = await purchaseService.updateItem(
        purchaseId,
        itemId,
        req.validated,
      );

      return res
        .status(202)
        .json(toPublicPurchase(purchase, { includeItems: true }));
    } catch (error) {
      return handlePurchaseError(error, res);
    }
  },
);

module.exports = router;
