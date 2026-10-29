const { Router } = require("express");
const { toPublicPurchase } = require("./serializer");
const { readAccess } = require("./guards");
const { purchaseService } = require("./purchase-service");
const { handlePurchaseError } = require("./shared");
const {
  CURRENCY_FILTER_MESSAGE,
  NUMBER_FILTER_MESSAGE,
  STATUS_MESSAGE,
  SUPPLIER_FILTER_MESSAGE,
  parseCurrencyFilter,
  parseNumberFilter,
  parsePurchaseId,
  parseStatusFilter,
  parseSupplierFilter,
} = require("./parsers");

const router = Router();

const FILTER_SPECS = Object.freeze([
  {
    query: "supplier_id",
    key: "supplierId",
    parse: parseSupplierFilter,
    message: SUPPLIER_FILTER_MESSAGE,
  },
  {
    query: "status",
    key: "status",
    parse: parseStatusFilter,
    message: STATUS_MESSAGE,
  },
  {
    query: "number",
    key: "number",
    parse: parseNumberFilter,
    message: NUMBER_FILTER_MESSAGE,
  },
  {
    query: "currency_id",
    key: "currencyId",
    parse: parseCurrencyFilter,
    message: CURRENCY_FILTER_MESSAGE,
  },
]);

/**
 * Parses the optional exact filters in documented order.
 * @param {object} query - Express query object.
 * @returns {{ filters: object }|{ error: { status: number, body: object } }}
 *   The service filters or the HTTP error to answer.
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
 * /purchases:
 *   get:
 *     summary: Lists purchases; admin, seller and manager_warehouse can do it
 *     description: >
 *       Returns purchases ordered by `number` descending. Optional exact
 *       filters: `supplier_id`, `status`, `number` and `currency_id`. Send
 *       `?include=items` to nest the purchase lines. Timestamps are never
 *       exposed.
 *     tags:
 *       - Purchases
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: supplier_id
 *         schema: { type: integer, minimum: 1 }
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [draft, confirmed, cancelled] }
 *       - in: query
 *         name: number
 *         schema: { type: integer, minimum: 1 }
 *       - in: query
 *         name: currency_id
 *         schema: { type: integer, minimum: 1 }
 *       - in: query
 *         name: include
 *         schema: { type: string, enum: [items] }
 *     responses:
 *       200:
 *         description: Purchases ordered by number descending
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Purchase'
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
 *         description: Invalid filter
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ValidationErrors' }
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get("/", ...readAccess(), async (req, res) => {
  const { filters, error } = resolveFilters(req.query);

  if (error) {
    return res.status(error.status).json(error.body);
  }

  const includeItems = req.query.include === "items";
  const purchases = await purchaseService.listPurchases({
    ...filters,
    includeItems,
  });

  return res.json(
    purchases.map((purchase) => toPublicPurchase(purchase, { includeItems })),
  );
});

/**
 * @openapi
 * /purchases/{id}:
 *   get:
 *     summary: Returns one purchase with its lines and nested supplier
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
 *       200:
 *         description: Purchase detail
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PurchaseDetail'
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
 *             example: { message: Purchase not found }
 *       422:
 *         description: Invalid purchase id
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ValidationErrors' }
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get("/:id", ...readAccess(), async (req, res) => {
  const id = parsePurchaseId(req.params.id);

  if (id === null) {
    return res.status(422).json({ errors: { id: "Invalid purchase id" } });
  }

  try {
    const purchase = await purchaseService.getPurchase(id);

    return res.json(
      toPublicPurchase(purchase, {
        includeItems: true,
        includeSupplier: true,
      }),
    );
  } catch (error) {
    return handlePurchaseError(error, res);
  }
});

module.exports = router;
