const { Router } = require("express");
const { readAccess } = require("./guards");
const { inboxService } = require("./service");
const { toPublicInboxLot } = require("./serializer");
const { resolveListQuery } = require("./query");
const { parsePositiveInteger } = require("./parsers");
const { PRODUCT_ID_MESSAGE } = require("./validators");

const router = Router();

/**
 * @openapi
 * /warehouse-inbox/products/{product_id}/lots:
 *   get:
 *     summary: Lists the pending lots of one product; admin, seller and manager_warehouse
 *     description: >
 *       Alias of `GET /warehouse-inbox/lots?product_id=` used to start locating
 *       every lot of a product. It accepts the same optional `purchase_id`,
 *       `lot_number`, `status` and `expiring_before` filters and returns the
 *       same rows ordered by `createdAt` and `id`.
 *     tags:
 *       - Warehouse inbox
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: product_id
 *         required: true
 *         schema: { type: integer, minimum: 1 }
 *     responses:
 *       200:
 *         description: Pending lots of the product
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
 *         description: Invalid product id or filter
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ValidationErrors' }
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get("/products/:product_id/lots", ...readAccess(), async (req, res) => {
  const productId = parsePositiveInteger(req.params.product_id);

  if (productId === null) {
    return res.status(422).json({
      errors: { product_id: PRODUCT_ID_MESSAGE },
    });
  }

  const query = resolveListQuery(req.query);

  if (query.errors) {
    return res.status(422).json({ errors: query.errors });
  }

  const lots = await inboxService.listLots({
    ...query.filters,
    productId,
  });

  return res.json(lots.map((lot) => toPublicInboxLot(lot)));
});

module.exports = router;
