const { Router } = require("express");
const { toPublicCost } = require("./serializer");
const { loadCost } = require("./shared");
const { readAccess } = require("./guards");
const { costRepository } = require("./repository");
const {
  CURRENCY_FILTER_MESSAGE,
  ITEM_STATE_FILTER_MESSAGE,
  PRODUCT_FILTER_MESSAGE,
  parseCurrencyId,
  parseItemStateId,
  parseProductId,
} = require("./validators");

const router = Router();

const FILTER_SPECS = Object.freeze([
  {
    query: "product_id",
    key: "productId",
    parse: parseProductId,
    message: PRODUCT_FILTER_MESSAGE,
  },
  {
    query: "item_state_id",
    key: "itemStateId",
    parse: parseItemStateId,
    message: ITEM_STATE_FILTER_MESSAGE,
  },
  {
    query: "currency_id",
    key: "currencyId",
    parse: parseCurrencyId,
    message: CURRENCY_FILTER_MESSAGE,
  },
]);

/**
 * Parses the optional exact filters in documented order.
 * @param {object} query - Express query object.
 * @returns {{ filters: object }|{ error: { status: number, body: object } }}
 *   The repository filters or the HTTP error to answer.
 */
function resolveFilters(query) {
  const filters = {};

  for (const spec of FILTER_SPECS) {
    const raw = query[spec.query];

    if (raw === undefined) {
      continue;
    }

    const value = spec.parse(raw);

    if (value === null) {
      return {
        error: {
          status: 422,
          body: { errors: { [spec.query]: spec.message } },
        },
      };
    }

    filters[spec.key] = value;
  }

  return { filters };
}

/**
 * @openapi
 * /costs:
 *   get:
 *     summary: Lists costs; administrators, sellers and warehouse managers can do it
 *     description: >
 *       Returns every cost ordered by `product_id` and `item_state_id`
 *       ascending. The optional `product_id`, `item_state_id` and
 *       `currency_id` filters are exact. Every row includes the nested item
 *       state and currency without timestamps.
 *     tags:
 *       - Costs
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
 *         example: 2
 *       - in: query
 *         name: currency_id
 *         required: false
 *         schema:
 *           type: integer
 *           minimum: 1
 *         example: 3
 *     responses:
 *       200:
 *         description: Costs ordered by product and item state
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Cost'
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
 *         description: Invalid product_id or item_state_id filter
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ValidationErrors'
 *             example:
 *               errors:
 *                 product_id: Invalid product id
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get("/", ...readAccess(), async (req, res) => {
  const { filters, error } = resolveFilters(req.query);

  if (error) {
    return res.status(error.status).json(error.body);
  }

  const costs = await costRepository.list(filters);

  return res.json(costs.map((cost) => toPublicCost(cost)));
});

/**
 * @openapi
 * /costs/product/{product_id}:
 *   get:
 *     summary: Lists every cost of one product; allowed to admin, seller and manager_warehouse
 *     description: >
 *       Returns one cost per item state ordered by `item_state_id`. When the
 *       product has no costs it responds 200 with an empty array, never 404.
 *     tags:
 *       - Costs
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
 *         description: Costs of the product; empty array when there are none
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Cost'
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
 *                 product_id: Invalid product id
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

  const costs = await costRepository.listByProduct(productId);

  return res.json(costs.map((cost) => toPublicCost(cost)));
});

/**
 * @openapi
 * /costs/{id}:
 *   get:
 *     summary: Returns one cost; allowed to admin, seller and manager_warehouse
 *     tags:
 *       - Costs
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *         example: 1
 *     responses:
 *       200:
 *         description: Public cost data with its nested item state
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Cost'
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
 *         description: The cost does not exist
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *             example:
 *               message: Cost not found
 *       422:
 *         description: Invalid cost id
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ValidationErrors'
 *             example:
 *               errors:
 *                 id: Invalid cost id
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get("/:id", ...readAccess(), loadCost, (req, res) =>
  res.json(toPublicCost(req.cost)),
);

module.exports = router;
