const { Router } = require("express");
const { toPublicLot } = require("./serializer");
const { readAccess } = require("./guards");
const { lotService } = require("./service");
const {
  EXPIRED_MESSAGE,
  EXPIRING_BEFORE_MESSAGE,
  ITEM_STATE_ID_MESSAGE,
  NUMBER_FILTER_MESSAGE,
  PRODUCT_ID_MESSAGE,
  SECTION_ID_MESSAGE,
  SHELF_ID_MESSAGE,
  WAREHOUSE_ID_MESSAGE,
} = require("./validators");
const {
  parseExpired,
  parseExpiringBefore,
  parseNumberFilter,
  parsePositiveInteger,
} = require("./parsers");

const router = Router();

/**
 * Strategy table for the optional listing filters: each entry knows the query
 * parameter, the filter key consumed by the repository, the parser and the
 * message used when the value is malformed.
 * @type {ReadonlyArray<{ query: string, key: string, parse: Function,
 *   message: string, invalid?: unknown }>}
 */
const QUERY_FILTERS = Object.freeze([
  {
    query: "product_id",
    key: "productId",
    parse: parsePositiveInteger,
    message: PRODUCT_ID_MESSAGE,
  },
  {
    query: "item_state_id",
    key: "itemStateId",
    parse: parsePositiveInteger,
    message: ITEM_STATE_ID_MESSAGE,
  },
  {
    query: "warehouse_id",
    key: "warehouseId",
    parse: parsePositiveInteger,
    message: WAREHOUSE_ID_MESSAGE,
  },
  {
    query: "shelf_id",
    key: "shelfId",
    parse: parsePositiveInteger,
    message: SHELF_ID_MESSAGE,
  },
  {
    query: "section_id",
    key: "sectionId",
    parse: parsePositiveInteger,
    message: SECTION_ID_MESSAGE,
  },
  {
    query: "number",
    key: "number",
    parse: parseNumberFilter,
    message: NUMBER_FILTER_MESSAGE,
  },
  {
    query: "expired",
    key: "expired",
    parse: parseExpired,
    message: EXPIRED_MESSAGE,
    invalid: undefined,
  },
  {
    query: "expiring_before",
    key: "expiringBefore",
    parse: parseExpiringBefore,
    message: EXPIRING_BEFORE_MESSAGE,
  },
]);

/**
 * Resolves and validates every listing filter using the strategy table.
 * Malformed values answer 422 instead of being silently ignored.
 * @param {object} query - Express query object.
 * @returns {{ filters: object }|{ errors: Record<string, string> }} The
 *   filters or the validation errors.
 */
function resolveListQuery(query) {
  const filters = {};
  const errors = {};

  for (const descriptor of QUERY_FILTERS) {
    const raw = query[descriptor.query];

    if (raw === undefined) {
      continue;
    }

    // `expired` uses undefined as its invalid sentinel, so only fall back to
    // null when the descriptor does not declare an `invalid` value.
    const invalid = Object.prototype.hasOwnProperty.call(descriptor, "invalid")
      ? descriptor.invalid
      : null;
    const value = descriptor.parse(raw);

    if (value === invalid) {
      errors[descriptor.query] = descriptor.message;
    } else {
      filters[descriptor.key] = value;
    }
  }

  return Object.keys(errors).length > 0 ? { errors } : { filters };
}

/**
 * @openapi
 * /lots:
 *   get:
 *     summary: Lists lots; admin, seller, manager_warehouse and dispatcher
 *     description: >
 *       Returns lots ordered by `expiration_date` and then `id`, both
 *       ascending. Optional exact filters: `product_id`, `item_state_id`,
 *       `warehouse_id`, `shelf_id`, `section_id`, `number` and
 *       `expiring_before` (inclusive). `expired=true` returns dates before
 *       today and `expired=false` dates from today onward. Every row is
 *       eager-loaded with product, item state, warehouse, shelf and section
 *       (no N+1) and exposes `available = stock - reserved`.
 *     tags:
 *       - Lots
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - { in: query, name: product_id, schema: { type: integer, minimum: 1 } }
 *       - { in: query, name: item_state_id, schema: { type: integer, minimum: 1 } }
 *       - { in: query, name: warehouse_id, schema: { type: integer, minimum: 1 } }
 *       - { in: query, name: shelf_id, schema: { type: integer, minimum: 1 } }
 *       - { in: query, name: section_id, schema: { type: integer, minimum: 1 } }
 *       - { in: query, name: number, schema: { type: string, maxLength: 100 } }
 *       - { in: query, name: expired, schema: { type: boolean } }
 *       - { in: query, name: expiring_before, schema: { type: string, format: date } }
 *     responses:
 *       200:
 *         description: Lots ordered by expiration date and id
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items: { $ref: '#/components/schemas/Lot' }
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
  const query = resolveListQuery(req.query);

  if (query.errors) {
    return res.status(422).json({ errors: query.errors });
  }

  const lots = await lotService.listLots(query.filters);

  return res.json(lots.map((lot) => toPublicLot(lot)));
});

module.exports = router;
