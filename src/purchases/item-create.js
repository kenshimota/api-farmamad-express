const { Router } = require("express");
const { toPublicPurchase } = require("./serializer");
const {
  REQUIRED_PURCHASE_ITEM_FIELDS,
  createPurchaseItemSchema,
} = require("./validators");
const { validatedBody, writeAccess } = require("./guards");
const { purchaseService } = require("./purchase-service");
const { handlePurchaseError } = require("./shared");
const { purchaseIdOrRespond } = require("./item-router-shared");

const router = Router();

/**
 * @openapi
 * /purchases/{id}/items:
 *   post:
 *     summary: Adds a line to a draft purchase
 *     description: >
 *       Requires the line `tax_amount`, validates the product and item state
 *       references, rejects a repeated product/item state pair with 409,
 *       recalculates the purchase and responds 201 with the updated purchase
 *       and its lines.
 *     tags: [Purchases]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer, minimum: 1 }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/PurchaseItemInput' }
 *     responses:
 *       201:
 *         description: Updated purchase with its lines
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/PurchaseDetail' }
 *       400:
 *         description: Missing line fields
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
 *         description: The purchase does not exist
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorMessage' }
 *       409:
 *         description: Item already exists or purchase is not editable
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorMessage' }
 *       422:
 *         description: Invalid fields or non-existent references
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ValidationErrors' }
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post(
  "/:id/items",
  ...writeAccess(),
  ...validatedBody(createPurchaseItemSchema, REQUIRED_PURCHASE_ITEM_FIELDS),
  async (req, res) => {
    const id = purchaseIdOrRespond(req, res);

    if (id === null) {
      return undefined;
    }

    try {
      const purchase = await purchaseService.addItem(id, req.validated);

      return res
        .status(201)
        .json(toPublicPurchase(purchase, { includeItems: true }));
    } catch (error) {
      return handlePurchaseError(error, res);
    }
  },
);

module.exports = router;
