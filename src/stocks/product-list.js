const { Router } = require("express");
const { toPublicStock } = require("./serializer");
const { readAccess } = require("./guards");
const { stockRepository } = require("./repository");
const { parseProductId, PRODUCT_FILTER_MESSAGE } = require("./validators");

const router = Router();

/**
 * @openapi
 * /stocks/product/{product_id}:
 *   get:
 *     summary: Lists the stock of one product; allowed to admin, seller and manager_warehouse
 *     description: >
 *       Returns one row per item state ordered by `item_state_id`. When the
 *       product has no stock it responds 200 with an empty array, never 404,
 *       even when the product does not exist.
 *     tags:
 *       - Stocks
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: product_id
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *         example: 15
 *     responses:
 *       200:
 *         description: Stock of the product; empty array when there is none
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
 *         description: Invalid product id
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
router.get("/product/:product_id", ...readAccess(), async (req, res) => {
  const productId = parseProductId(req.params.product_id);

  if (productId === null) {
    return res.status(422).json({
      errors: { product_id: PRODUCT_FILTER_MESSAGE },
    });
  }

  const stocks = await stockRepository.listByProduct(productId);

  return res.json(stocks.map((stock) => toPublicStock(stock)));
});

module.exports = router;
