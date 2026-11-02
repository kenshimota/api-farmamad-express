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
const { parseListQuery } = require("../shared/list-query");
const { sendListResponse } = require("../shared/pagination");
const { SORT_FIELDS } = require("./repository");

const router = Router();

const WAREHOUSE_FILTER_MESSAGE = "Invalid warehouse_id";
const LOW_STOCK_MESSAGE = "low_stock must be a boolean";

const FILTER_SPECS = Object.freeze([
  {
    query: "product_id",
    field: "productId",
    parse: parseProductId,
    message: PRODUCT_FILTER_MESSAGE,
  },
  {
    query: "warehouse_id",
    field: "warehouseId",
    parse: parseProductId,
    message: WAREHOUSE_FILTER_MESSAGE,
  },
  {
    query: "item_state_id",
    field: "itemStateId",
    parse: parseItemStateId,
    message: ITEM_STATE_FILTER_MESSAGE,
  },
  {
    query: "in_stock",
    field: "inStock",
    parse: (value) => {
      const parsed = parseInStock(value);
      return parsed === undefined ? null : parsed;
    },
    message: IN_STOCK_MESSAGE,
  },
  {
    query: "low_stock",
    field: "lowStock",
    parse: (value) => {
      const parsed = parseInStock(value);
      return parsed === undefined ? null : parsed;
    },
    message: LOW_STOCK_MESSAGE,
  },
]);

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
 *       - { in: query, name: page, schema: { type: integer, minimum: 1, default: 1 } }
 *       - { in: query, name: page_size, schema: { type: integer, minimum: 1, maximum: 100, default: 20 } }
 *       - { in: query, name: sort, schema: { type: string } }
 *       - { in: query, name: order, schema: { type: string, enum: [asc, desc], default: asc } }
 *       - { in: query, name: q, schema: { type: string }, description: Partial case-insensitive search }
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
  const query = parseListQuery(req.query, {
    filters: FILTER_SPECS,
    sortFields: SORT_FIELDS,
    defaultOrder: [
      ["product_id", "ASC"],
      ["item_state_id", "ASC"],
    ],
  });

  if (query.errors) {
    return res.status(422).json({ errors: query.errors });
  }

  const result = await stockRepository.list(query.filters, {
    pagination: query.pagination,
    order: query.order,
  });

  return sendListResponse(res, result, (stock) => toPublicStock(stock));
});
module.exports = router;
