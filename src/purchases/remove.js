const { Router } = require("express");
const { writeAccess } = require("./guards");
const { purchaseService } = require("./purchase-service");
const { handlePurchaseError } = require("./shared");
const { parsePurchaseId } = require("./parsers");

const router = Router();

/**
 * @openapi
 * /purchases/{id}:
 *   delete:
 *     summary: Deletes a draft purchase; only administrators and sellers can do it
 *     description: >
 *       Deletes the purchase and, through the database cascade, all of its
 *       lines. Confirmed and cancelled purchases are immutable and answer
 *       409. The response has no body.
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
 *       204:
 *         description: Purchase deleted; no body
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
router.delete("/:id", ...writeAccess(), async (req, res) => {
  const id = parsePurchaseId(req.params.id);

  if (id === null) {
    return res.status(422).json({ errors: { id: "Invalid purchase id" } });
  }

  try {
    await purchaseService.deletePurchase(id);

    return res.status(204).send();
  } catch (error) {
    return handlePurchaseError(error, res);
  }
});

module.exports = router;
