const { Router } = require("express");
const Customer = require("../models/customer");
const { authenticate } = require("../auth/middleware");
const { authorize } = require("../auth/authorize");
const { toPublicCustomer } = require("./serializer");
const { CUSTOMER_INCLUDE, loadCustomer } = require("./shared");
const { parsePositiveInteger } = require("../shared/parsers");
const { parseListQuery, buildTextSearch } = require("../shared/list-query");
const { findPage, sendListResponse } = require("../shared/pagination");

const router = Router();

const FILTER_SPECS = Object.freeze([
  {
    query: "state_id",
    field: "stateId",
    parse: parsePositiveInteger,
    message: "Invalid state_id",
  },
  {
    query: "city_id",
    field: "cityId",
    parse: parsePositiveInteger,
    message: "Invalid city_id",
  },
  {
    query: "seller_id",
    field: "sellerId",
    parse: parsePositiveInteger,
    message: "Invalid seller_id",
  },
]);

const SORT_FIELDS = Object.freeze(["id", "fullName", "email"]);

/**
 * Builds the Sequelize options of the customer listing.
 * @param {object} filters - Parsed filters.
 * @param {Array<[string, string]>} order - Order clauses.
 * @returns {object} Options accepted by `Customer.findAll`.
 */
function buildListOptions(filters, order) {
  const include = [...CUSTOMER_INCLUDE];
  const where = {};

  if (filters.sellerId !== undefined) {
    const CustomerSeller = require("../models/customer-seller");

    include.push({
      model: CustomerSeller,
      as: "sellerAssignment",
      attributes: [],
      required: true,
      where: { seller_id: filters.sellerId },
    });
  }

  const search = buildTextSearch(filters.q, ["fullName", "email", "direction"]);

  if (search) {
    Object.assign(where, search);
  }

  const options = { include, order };

  if (Reflect.ownKeys(where).length > 0) {
    options.where = where;
  }

  return options;
}

/**
 * @openapi
 * /customers:
 *   get:
 *     summary: Lists every customer; administrators, sellers and dispatcher users can do it
 *     tags:
 *       - Customers
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - { in: query, name: page, schema: { type: integer, minimum: 1, default: 1 } }
 *       - { in: query, name: page_size, schema: { type: integer, minimum: 1, maximum: 100, default: 20 } }
 *       - { in: query, name: sort, schema: { type: string } }
 *       - { in: query, name: order, schema: { type: string, enum: [asc, desc], default: asc } }
 *       - { in: query, name: q, schema: { type: string }, description: Partial case-insensitive search }
 *     responses:
 *       200:
 *         description: Customers ordered by id ascending with public fields only
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Customer'
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
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get(
  "/",
  authenticate,
  authorize("admin", "seller", "dispatcher"),
  async (req, res) => {
    const query = parseListQuery(req.query, {
      filters: FILTER_SPECS,
      sortFields: SORT_FIELDS,
      defaultOrder: [["id", "ASC"]],
    });

    if (query.errors) {
      return res.status(422).json({ errors: query.errors });
    }

    const result = await findPage(
      Customer,
      buildListOptions({ ...query.filters, q: query.q }, query.order),
      query.pagination,
    );

    return sendListResponse(res, result, (customer) =>
      toPublicCustomer(customer),
    );
  },
);

/**
 * @openapi
 * /customers/{id}:
 *   get:
 *     summary: Returns one customer; administrators, sellers and dispatcher users can do it
 *     tags:
 *       - Customers
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
 *         description: Public customer data
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Customer'
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
 *         description: The customer does not exist
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *             example:
 *               message: Customer not found
 *       422:
 *         description: Invalid customer id
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ValidationErrors'
 *             example:
 *               errors:
 *                 id: Invalid customer id
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get(
  "/:id",
  authenticate,
  authorize("admin", "seller", "dispatcher"),
  loadCustomer,
  (req, res) => res.json(toPublicCustomer(req.customer)),
);

module.exports = router;
