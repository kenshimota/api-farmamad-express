const { Router } = require("express");
const { writeAccess } = require("./guards");
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
 *   delete:
 *     summary: Deletes a line of a draft purchase
 *     description: >
 *       Removes the line, recalculates the purchase and responds 204. When the
 *       last line is removed every total becomes zero.
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
 *     responses:
 *       204:
 *         description: Line deleted; no body
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
 *         description: Purchase is not editable
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorMessage' }
 *       422:
 *         description: Invalid ids
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ValidationErrors' }
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.delete(
  "/:purchase_id/items/:item_id",
  ...writeAccess(),
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
      await purchaseService.deleteItem(purchaseId, itemId);

      return res.status(204).send();
    } catch (error) {
      return handlePurchaseError(error, res);
    }
  },
);

module.exports = router;
