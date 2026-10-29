const { Router } = require("express");
const { toPublicPurchase } = require("./serializer");
const { createPurchaseSchema } = require("./validators");
const { validatedBody, writeAccess } = require("./guards");
const { purchaseService } = require("./purchase-service");
const { handlePurchaseError } = require("./shared");
const listRouter = require("./list");
const updateRouter = require("./update");
const removeRouter = require("./remove");
const cancelRouter = require("./cancel");
const confirmRouter = require("./confirm");
const itemsRouter = require("./purchase-items");

const router = Router();

/**
 * @openapi
 * /purchases:
 *   post:
 *     summary: Creates a draft purchase; only administrators and sellers can do it
 *     description: >
 *       Assigns an ascending server-side `number`, ignores any
 *       `number`, `status`, totals or `confirmed_at` sent by the client and
 *       calculates the subtotal, tax and total from the optional `items`.
 *       `tax_rate` defaults to `PURCHASE_TAX_RATE` (16 when unset).
 *     tags:
 *       - Purchases
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [supplier_id]
 *             properties:
 *               supplier_id: { type: integer, minimum: 1, example: 1 }
 *               tax_rate: { type: number, minimum: 0, maximum: 100, example: 16 }
 *               notes: { type: string, maxLength: 1000, example: Reposición mensual }
 *               items:
 *                 type: array
 *                 items: { $ref: '#/components/schemas/PurchaseItem' }
 *     responses:
 *       201:
 *         description: Purchase created with its items
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/PurchaseDetail' }
 *       400:
 *         description: Missing supplier_id
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorMessage' }
 *             example: { message: supplier_id is required }
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
 *       409:
 *         description: Duplicated product/item state line
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorMessage' }
 *             example: { message: Item already exists }
 *       422:
 *         description: Invalid fields or non-existent references
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ValidationErrors' }
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post(
  "/",
  ...writeAccess(),
  ...validatedBody(createPurchaseSchema),
  async (req, res) => {
    try {
      const purchase = await purchaseService.createPurchase(req.validated);

      return res
        .status(201)
        .json(toPublicPurchase(purchase, { includeItems: true }));
    } catch (error) {
      return handlePurchaseError(error, res);
    }
  },
);

router.use(listRouter);
router.use(updateRouter);
router.use(removeRouter);
router.use(cancelRouter);
router.use(confirmRouter);
router.use(itemsRouter);

module.exports = router;
