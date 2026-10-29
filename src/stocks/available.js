const { Router } = require("express");
const { toAvailableStock } = require("./serializer");
const { readAccess } = require("./guards");
const { stockRepository } = require("./repository");
const { parseProductId, PRODUCT_FILTER_MESSAGE } = require("./validators");

const router = Router();

/**
 * Answers the sellable stock of one product. Both routes share the same
 * handler because the product id can arrive as a query parameter or as a path
 * parameter.
 * @param {import("express").Request} req - Express request.
 * @param {import("express").Response} res - Express response.
 * @returns {Promise<import("express").Response>} The JSON response.
 */
async function sendAvailable(req, res) {
  const rawProductId = req.params.product_id ?? req.query.product_id;
  const productId = parseProductId(rawProductId);

  if (productId === null) {
    return res.status(422).json({
      errors: { product_id: PRODUCT_FILTER_MESSAGE },
    });
  }

  const stocks = await stockRepository.listAvailable(productId);

  return res.json(stocks.map((stock) => toAvailableStock(stock)));
}

/**
 * @openapi
 * /stocks/available:
 *   get:
 *     summary: Lists the sellable stock of a product; allowed to admin, seller and manager_warehouse
 *     description: >
 *       Returns only the rows with `quantity > 0` whose item state is
 *       `is_sellable = true`, ordered by item state name ascending. Each row
 *       includes the current cost of the same `(product_id, item_state_id)`
 *       combination or `null` when no cost is registered, together with the
 *       currency of that cost (`currency_id` and `currency`, both null without
 *       cost). Stocks, item states, costs and currencies are resolved in one
 *       Sequelize join, without N+1.
 *     tags:
 *       - Stocks
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: product_id
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *         example: 15
 *     responses:
 *       200:
 *         description: Sellable stock with its current cost or null
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/AvailableStock'
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
 *         description: Missing or invalid product_id
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
router.get("/available", ...readAccess(), sendAvailable);

/**
 * @openapi
 * /stocks/available/{product_id}:
 *   get:
 *     summary: Alias of GET /stocks/available?product_id=
 *     description: >
 *       Returns exactly the same sellable stock rows, current costs and
 *       currencies as `GET /stocks/available?product_id=`. The response is
 *       ordered by item state name and keeps `cost`, `currency_id` and
 *       `currency` in `null` when the combination has no cost.
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
 *         description: Sellable stock with its current cost or null
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/AvailableStock'
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
router.get("/available/:product_id", ...readAccess(), sendAvailable);

module.exports = router;
