const { Router } = require("express");
const { toPublicCustomerSeller } = require("./serializer");
const { isSeller, readAccess } = require("./guards");
const { customerSellerService } = require("./service");
const { parsePositiveInteger } = require("./parsers");
const {
  INVALID_CUSTOMER_MESSAGE,
  INVALID_SELLER_MESSAGE,
} = require("./validators");

const router = Router();

/**
 * Strategy table for the optional listing filters: each entry knows the query
 * parameter, the filter key consumed by the repository, the parser and the
 * message used when the value is malformed.
 * @type {ReadonlyArray<{ query: string, key: string, parse: Function,
 *   message: string }>}
 */
const QUERY_FILTERS = Object.freeze([
  {
    query: "customer_id",
    key: "customerId",
    parse: parsePositiveInteger,
    message: INVALID_CUSTOMER_MESSAGE,
  },
  {
    query: "seller_id",
    key: "sellerId",
    parse: parsePositiveInteger,
    message: INVALID_SELLER_MESSAGE,
  },
]);

/**
 * Resolves and validates every listing filter. Malformed values answer 422 and
 * a seller asking for another seller answers 403; a seller without
 * `seller_id` is automatically scoped to their own assignments.
 * @param {object} query - Express query object.
 * @param {object} user - Authenticated token payload.
 * @returns {{ filters: object }|{ status: number, body: object }} The result.
 */
function resolveListFilters(query, user) {
  const filters = {};
  const errors = {};

  for (const descriptor of QUERY_FILTERS) {
    const raw = query[descriptor.query];

    if (raw === undefined) {
      continue;
    }

    const value = descriptor.parse(raw);

    if (value === null) {
      errors[descriptor.query] = descriptor.message;
    } else {
      filters[descriptor.key] = value;
    }
  }

  if (Object.keys(errors).length > 0) {
    return { status: 422, body: { errors } };
  }

  if (isSeller(user)) {
    const ownId = Number(user.sub);

    if (filters.sellerId !== undefined && filters.sellerId !== ownId) {
      return { status: 403, body: { message: "Forbidden" } };
    }

    filters.sellerId = ownId;
  }

  return { filters };
}

/**
 * @openapi
 * /customer-sellers:
 *   get:
 *     summary: Lists customer-seller assignments; admin, dispatcher and seller
 *     description: >
 *       Returns assignments ordered by `customer_id` ascending. Optional exact
 *       filters: `customer_id` and `seller_id`. Administrators and dispatchers
 *       see every assignment. A seller always sees only their own rows: when
 *       they omit `seller_id` the API filters by their token, and when they ask
 *       for another seller it answers 403. A customer without an assignment
 *       returns an empty array. Every row is eager-loaded with its customer and
 *       seller (no N+1).
 *     tags:
 *       - Customer sellers
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - { in: query, name: customer_id, schema: { type: integer, minimum: 1 } }
 *       - { in: query, name: seller_id, schema: { type: integer, minimum: 1 } }
 *     responses:
 *       200:
 *         description: Assignments ordered by customer_id
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items: { $ref: '#/components/schemas/CustomerSeller' }
 *       401:
 *         description: Missing, invalid or expired token
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorMessage' }
 *       403:
 *         description: Role without permission or seller asking for another seller
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
  const result = resolveListFilters(req.query, req.user);

  if (result.status !== undefined) {
    return res.status(result.status).json(result.body);
  }

  const assignments = await customerSellerService.listAssignments(
    result.filters,
  );

  return res.json(
    assignments.map((assignment) => toPublicCustomerSeller(assignment)),
  );
});

module.exports = router;
module.exports.resolveListFilters = resolveListFilters;
