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
const {
  parseListQuery,
  parseDateOnly,
  needsListOptions,
} = require("../shared/list-query");
const { sendListResponse } = require("../shared/pagination");
const { SORT_FIELDS } = require("./repository");

const router = Router();

const FILTER_SPECS = Object.freeze([
  {
    query: "supplier_id",
    field: "supplierId",
    parse: parseSupplierFilter,
    message: SUPPLIER_FILTER_MESSAGE,
  },
  {
    query: "status",
    field: "status",
    parse: parseStatusFilter,
    message: STATUS_MESSAGE,
  },
  {
    query: "number",
    field: "number",
    parse: parseNumberFilter,
    message: NUMBER_FILTER_MESSAGE,
  },
  {
    query: "currency_id",
    field: "currencyId",
    parse: parseCurrencyFilter,
    message: CURRENCY_FILTER_MESSAGE,
  },
  {
    query: "from",
    field: "from",
    parse: parseDateOnly,
    message: "Invalid from",
  },
  {
    query: "to",
    field: "to",
    parse: parseDateOnly,
    message: "Invalid to",
  },
]);

/**
 * Parses the optional filters, sort and pagination of the purchase listing.
 * @param {object} query - Express query object.
 * @returns {{ query: object }|{ error: { status: number, body: object } }}
 *   The parsed query or the HTTP error to answer.
 */
function resolveFilters(query) {
  const parsed = parseListQuery(query, {
    filters: FILTER_SPECS,
    sortFields: SORT_FIELDS,
    defaultOrder: [["number", "DESC"]],
  });

  if (parsed.errors) {
    return { error: { status: 422, body: { errors: parsed.errors } } };
  }

  return { query: parsed };
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
 *       - { in: query, name: page, schema: { type: integer, minimum: 1, default: 1 } }
 *       - { in: query, name: page_size, schema: { type: integer, minimum: 1, maximum: 100, default: 20 } }
 *       - { in: query, name: sort, schema: { type: string } }
 *       - { in: query, name: order, schema: { type: string, enum: [asc, desc], default: asc } }
 *       - { in: query, name: q, schema: { type: string }, description: Partial case-insensitive search }
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
  const { query, error } = resolveFilters(req.query);

  if (error) {
    return res.status(error.status).json(error.body);
  }

  const includeItems = req.query.include === "items";
  const filters = { ...query.filters, includeItems };

  if (query.q !== undefined) {
    filters.q = query.q;
  }

  const purchases = needsListOptions(query)
    ? await purchaseService.listPurchases(filters, {
        pagination: query.pagination,
        order: query.order,
      })
    : await purchaseService.listPurchases(filters);
  const serialize = (purchase) => toPublicPurchase(purchase, { includeItems });

  return sendListResponse(res, purchases, serialize);
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
