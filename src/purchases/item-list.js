const { Router } = require("express");
const { toPublicPurchaseItem } = require("./serializer");
const { readAccess } = require("./guards");
const { purchaseService } = require("./purchase-service");
const { handlePurchaseError } = require("./shared");
const { purchaseIdOrRespond } = require("./item-router-shared");

const router = Router();

/**
 * @openapi
 * /purchases/{id}/items:
 *   get:
 *     summary: Lists the lines of a draft purchase
 *     description: >
 *       Allowed to admin, seller and manager_warehouse. A non-draft purchase
 *       answers 409 because its lines are managed through the detail endpoint
 *       once confirmed.
 *     tags: [Purchases]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer, minimum: 1 }
 *     responses:
 *       200:
 *         description: Purchase lines ordered by id
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items: { $ref: '#/components/schemas/PurchaseItem' }
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
router.get("/:id/items", ...readAccess(), async (req, res) => {
  const id = purchaseIdOrRespond(req, res);

  if (id === null) {
    return undefined;
  }

  try {
    const items = await purchaseService.listItems(id);

    return res.json(items.map((item) => toPublicPurchaseItem(item)));
  } catch (error) {
    return handlePurchaseError(error, res);
  }
});

module.exports = router;
