const { Router } = require("express");
const { toPublicPurchase } = require("./serializer");
const {
  EDITABLE_PURCHASE_FIELDS,
  updatePurchaseSchema,
} = require("./validators");
const { requireAnyField, validatedBody, writeAccess } = require("./guards");
const { purchaseService } = require("./purchase-service");
const { handlePurchaseError } = require("./shared");
const { parsePurchaseId } = require("./parsers");

const router = Router();

/**
 * @openapi
 * /purchases/{id}:
 *   put:
 *     summary: Updates a draft purchase; only administrators and sellers can do it
 *     description: >
 *       Accepts `supplier_id`, `tax_rate` and/or `notes` and recalculates the
 *       totals. Lines are managed through `/purchases/{id}/items`; an `items`
 *       field in this body is ignored. Confirmed or cancelled purchases
 *       answer 409. A successful update responds 202.
 *     tags:
 *       - Purchases
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
 *           schema:
 *             type: object
 *             properties:
 *               supplier_id: { type: integer, minimum: 1, example: 1 }
 *               tax_rate: { type: number, minimum: 0, maximum: 100, example: 8.25 }
 *               notes: { type: string, maxLength: 1000, nullable: true }
 *     responses:
 *       202:
 *         description: Updated purchase with its items
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/PurchaseDetail' }
 *       400:
 *         description: No editable field was provided
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
 *         description: Purchase is not editable
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorMessage' }
 *             example: { message: Purchase is not editable }
 *       422:
 *         description: Invalid fields or non-existent supplier
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ValidationErrors' }
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.put(
  "/:id",
  ...writeAccess(),
  ...validatedBody(updatePurchaseSchema, []),
  requireAnyField(
    [...EDITABLE_PURCHASE_FIELDS],
    "At least one field is required",
  ),
  async (req, res) => {
    const id = parsePurchaseId(req.params.id);

    if (id === null) {
      return res.status(422).json({ errors: { id: "Invalid purchase id" } });
    }

    try {
      const purchase = await purchaseService.updatePurchase(id, req.validated);

      return res
        .status(202)
        .json(toPublicPurchase(purchase, { includeItems: true }));
    } catch (error) {
      return handlePurchaseError(error, res);
    }
  },
);

module.exports = router;
