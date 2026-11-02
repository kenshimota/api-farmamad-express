const { Router } = require("express");
const { toPublicLot } = require("./serializer");
const { readAccess } = require("./guards");
const { lotService } = require("./service");
const {
  EXPIRED_MESSAGE,
  EXPIRING_BEFORE_MESSAGE,
  ITEM_STATE_ID_MESSAGE,
  LOCATION_STATUS_MESSAGE,
  NUMBER_FILTER_MESSAGE,
  PRODUCT_ID_MESSAGE,
  SECTION_ID_MESSAGE,
  SHELF_ID_MESSAGE,
  WAREHOUSE_ID_MESSAGE,
} = require("./validators");
const { resolveQueryFilters } = require("../shared/query-filters");
const {
  parseExpired,
  parseExpiringBefore,
  parseLocationStatus,
  parseNumberFilter,
  parsePositiveInteger,
} = require("./parsers");

const router = Router();

/**
 * Strategy table for the optional listing filters: each entry knows the query
 * parameter, the filter key consumed by the repository, the parser and the
 * message used when the value is malformed.
 * @type {ReadonlyArray<{ query: string, field: string, parse: Function,
 *   message: string }>}
 */
const QUERY_FILTERS = Object.freeze([
  {
    query: "product_id",
    field: "productId",
    parse: parsePositiveInteger,
    message: PRODUCT_ID_MESSAGE,
  },
  {
    query: "item_state_id",
    field: "itemStateId",
    parse: parsePositiveInteger,
    message: ITEM_STATE_ID_MESSAGE,
  },
  {
    query: "warehouse_id",
    field: "warehouseId",
    parse: parsePositiveInteger,
    message: WAREHOUSE_ID_MESSAGE,
  },
  {
    query: "shelf_id",
    field: "shelfId",
    parse: parsePositiveInteger,
    message: SHELF_ID_MESSAGE,
  },
  {
    query: "section_id",
    field: "sectionId",
    parse: parsePositiveInteger,
    message: SECTION_ID_MESSAGE,
  },
  {
    query: "number",
    field: "number",
    parse: parseNumberFilter,
    message: NUMBER_FILTER_MESSAGE,
  },
  {
    query: "location_status",
    field: "locationStatus",
    parse: parseLocationStatus,
    message: LOCATION_STATUS_MESSAGE,
  },
  {
    query: "expired",
    field: "expired",
    parse: parseExpired,
    message: EXPIRED_MESSAGE,
  },
  {
    query: "expiring_before",
    field: "expiringBefore",
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
  return resolveQueryFilters(query, QUERY_FILTERS);
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
 *       `expiring_before` (inclusive) and `location_status`
 *       (`pending`, `in_progress`, `located`). `expired=true` returns dates
 *       before today and `expired=false` dates from today onward. Every row is
 *       eager-loaded with product, item state, warehouse, shelf and section
 *       (no N+1) and exposes `available = stock - reserved` for located lots
 *       and `0` while the lot is not located.
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
 *       - { in: query, name: location_status, schema: { type: string, enum: [pending, in_progress, located] } }
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
