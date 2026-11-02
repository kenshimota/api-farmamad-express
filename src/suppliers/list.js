const { Router } = require("express");
const { toPublicSupplier } = require("./serializer");
const { loadSupplierWithLocation } = require("./shared");
const { readAccess } = require("./guards");
const { supplierRepository } = require("./repository");
const {
  CITY_ID_MESSAGE,
  STATE_ID_MESSAGE,
  parseSupplierId,
} = require("./validators");
const { parseListQuery, needsListOptions } = require("../shared/list-query");
const { sendListResponse } = require("../shared/pagination");

const router = Router();

const FILTER_SPECS = Object.freeze([
  {
    query: "state_id",
    field: "stateId",
    parse: parseSupplierId,
    message: STATE_ID_MESSAGE,
  },
  {
    query: "city_id",
    field: "cityId",
    parse: parseSupplierId,
    message: CITY_ID_MESSAGE,
  },
]);

const SORT_FIELDS = Object.freeze([
  "id",
  "name",
  "identification",
  "state_id",
  "city_id",
]);

/**
 * @openapi
 * /suppliers:
 *   get:
 *     summary: Lists suppliers; any authenticated user can do it
 *     description: >
 *       Returns suppliers ordered by name with `city` and `state` nested. The
 *       optional `state_id` and `city_id` filters are exact; `q` searches
 *       partially and case-insensitively over name and identification.
 *     tags:
 *       - Suppliers
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: state_id
 *         required: false
 *         schema:
 *           type: integer
 *           minimum: 1
 *         example: 4
 *       - in: query
 *         name: city_id
 *         required: false
 *         schema:
 *           type: integer
 *           minimum: 1
 *         example: 10
 *       - in: query
 *         name: q
 *         required: false
 *         schema:
 *           type: string
 *         description: Partial term over name and identification
 *         example: salud
 *       - { in: query, name: page, schema: { type: integer, minimum: 1, default: 1 } }
 *       - { in: query, name: page_size, schema: { type: integer, minimum: 1, maximum: 100, default: 20 } }
 *       - { in: query, name: sort, schema: { type: string } }
 *       - { in: query, name: order, schema: { type: string, enum: [asc, desc], default: asc } }
 *       - { in: query, name: q, schema: { type: string }, description: Partial case-insensitive search }
 *     responses:
 *       200:
 *         description: Suppliers ordered by name with their location nested
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Supplier'
 *       401:
 *         description: Missing, invalid or expired token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *             example:
 *               message: Unauthorized
 *       403:
 *         description: Blocked user
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *             example:
 *               message: User is blocked
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       422:
 *         description: Invalid state_id or city_id filter
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ValidationErrors'
 *             example:
 *               errors:
 *                 state_id: Invalid state
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get("/", ...readAccess(), async (req, res) => {
  const query = parseListQuery(req.query, {
    filters: FILTER_SPECS,
    sortFields: SORT_FIELDS,
    defaultOrder: [["name", "ASC"]],
  });

  if (query.errors) {
    return res.status(422).json({ errors: query.errors });
  }

  const filters = { ...query.filters, q: query.q };
  const options = {
    pagination: query.pagination,
    order: query.order,
  };
  const suppliers = needsListOptions(query)
    ? await supplierRepository.list(filters, options)
    : await supplierRepository.list(filters);

  return sendListResponse(res, suppliers, (supplier) =>
    toPublicSupplier(supplier, { includeLocation: true }),
  );
});

/**
 * @openapi
 * /suppliers/{id}:
 *   get:
 *     summary: Returns one supplier; any authenticated user can do it
 *     description: Returns the supplier with `city` and `state` nested.
 *     tags:
 *       - Suppliers
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
 *         description: Public supplier data with its location nested
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Supplier'
 *       401:
 *         description: Missing, invalid or expired token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *             example:
 *               message: Unauthorized
 *       403:
 *         description: Blocked user
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *             example:
 *               message: User is blocked
 *       404:
 *         description: The supplier does not exist
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *             example:
 *               message: Supplier not found
 *       422:
 *         description: Invalid supplier id
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ValidationErrors'
 *             example:
 *               errors:
 *                 id: Invalid supplier id
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get("/:id", ...readAccess(), loadSupplierWithLocation, (req, res) =>
  res.json(toPublicSupplier(req.supplier, { includeLocation: true })),
);

module.exports = router;
