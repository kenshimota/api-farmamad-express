const { Router } = require("express");
const { toPublicStock } = require("./serializer");
const { readAccess } = require("./guards");
const { stockRepository } = require("./repository");
const {
  IN_STOCK_MESSAGE,
  ITEM_STATE_FILTER_MESSAGE,
  parseInStock,
  parseItemStateId,
  parseProductId,
  PRODUCT_FILTER_MESSAGE,
} = require("./validators");

const router = Router();

/**
 * @openapi
 * /stocks:
 *   get:
 *     summary: Lists the inventory; allowed to admin, seller and manager_warehouse
 *     description: >
 *       Returns one row per `(product_id, item_state_id)` ordered by product
 *       and item state ascending. Every row includes the nested item state
 *       without description or timestamps. The filters are optional and exact:
 *       `product_id`, `item_state_id` and `in_stock` (`true` means quantity
 *       greater than zero). This module only exposes read endpoints.
 *     tags:
 *       - Stocks
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: product_id
 *         required: false
 *         schema:
 *           type: integer
 *           minimum: 1
 *         example: 15
 *       - in: query
 *         name: item_state_id
 *         required: false
 *         schema:
 *           type: integer
 *           minimum: 1
 *         example: 1
 *       - in: query
 *         name: in_stock
 *         required: false
 *         schema:
 *           type: boolean
 *         example: true
 *     responses:
 *       200:
 *         description: Stock rows ordered by product and item state
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Stock'
 *       401:
 *         description: Missing, invalid or expired token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *             example:
 *               message: Unauthorized
 *       403:
 *         description: Role without permission or blocked user
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *             example:
 *               message: Forbidden
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       422:
 *         description: Invalid product_id, item_state_id or in_stock filter
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ValidationErrors'
 *             example:
 *               errors:
 *                 product_id: Invalid id
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get("/", ...readAccess(), async (req, res) => {
  const rawProductId = req.query.product_id;
  const rawItemStateId = req.query.item_state_id;
  const rawInStock = req.query.in_stock;
  let productId;
  let itemStateId;
  let inStock;

  if (rawProductId !== undefined) {
    productId = parseProductId(rawProductId);

    if (productId === null) {
      return res.status(422).json({
        errors: { product_id: PRODUCT_FILTER_MESSAGE },
      });
    }
  }

  if (rawItemStateId !== undefined) {
    itemStateId = parseItemStateId(rawItemStateId);

    if (itemStateId === null) {
      return res.status(422).json({
        errors: { item_state_id: ITEM_STATE_FILTER_MESSAGE },
      });
    }
  }

  if (rawInStock !== undefined) {
    inStock = parseInStock(rawInStock);

    if (inStock === undefined) {
      return res.status(422).json({
        errors: { in_stock: IN_STOCK_MESSAGE },
      });
    }
  }

  const stocks = await stockRepository.list({
    productId,
    itemStateId,
    inStock,
  });

  return res.json(stocks.map((stock) => toPublicStock(stock)));
});

module.exports = router;
