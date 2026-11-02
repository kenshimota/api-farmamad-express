const { Router } = require("express");
const User = require("../models/user");
const Role = require("../models/role");
const { authenticate } = require("../auth/middleware");
const { authorize } = require("../auth/authorize");
const { toPublicUser } = require("../auth/serializers");
const { parsePositiveInteger, parseBooleanFlag } = require("../shared/parsers");
const {
  parseListQuery,
  buildTextSearch,
  parseNonEmptyString,
} = require("../shared/list-query");
const { findPage, sendListResponse } = require("../shared/pagination");

const router = Router();

const FILTER_SPECS = Object.freeze([
  {
    query: "role",
    field: "role",
    parse: parseNonEmptyString,
    message: "Invalid role",
  },
  {
    query: "is_active",
    field: "isActive",
    parse: (value) => {
      const parsed = parseBooleanFlag(value);
      return parsed === undefined ? null : parsed;
    },
    message: "Invalid is_active",
  },
  {
    query: "customer_id",
    field: "customerId",
    parse: parsePositiveInteger,
    message: "Invalid customer_id",
  },
]);

const SORT_FIELDS = Object.freeze(["id", "username", "email", "name"]);

/**
 * Builds the Sequelize options of the user listing.
 * @param {object} filters - Parsed filters.
 * @param {Array<[string, string]>} order - Order clauses.
 * @returns {object} Options accepted by `User.findAll`.
 */
function buildListOptions(filters, order) {
  const where = {};

  if (filters.role !== undefined) {
    where["$role.name$"] = filters.role;
  }

  if (filters.isActive !== undefined) {
    where.isBlocked = filters.isActive === false;
  }

  if (filters.customerId !== undefined) {
    where.customer_id = filters.customerId;
  }

  const search = buildTextSearch(filters.q, ["username", "email", "name"]);

  if (search) {
    Object.assign(where, search);
  }

  const options = {
    include: { model: Role, as: "role" },
    order,
  };

  if (Reflect.ownKeys(where).length > 0) {
    options.where = where;
  }

  return options;
}

/**
 * @openapi
 * /users:
 *   get:
 *     summary: Lists every registered user; only administrators can do it
 *     tags:
 *       - Users
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
 *         description: Users ordered by id ascending, without password or roleId
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/User'
 *       401:
 *         description: Missing, invalid or expired token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *             example:
 *               message: Unauthorized
 *       403:
 *         description: Authenticated user without the administrator role
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
router.get("/", authenticate, authorize("admin"), async (req, res) => {
  const query = parseListQuery(req.query, {
    filters: FILTER_SPECS,
    sortFields: SORT_FIELDS,
    defaultOrder: [["id", "ASC"]],
  });

  if (query.errors) {
    return res.status(422).json({ errors: query.errors });
  }

  const result = await findPage(
    User,
    buildListOptions({ ...query.filters, q: query.q }, query.order),
    query.pagination,
  );

  return sendListResponse(res, result, (user) => toPublicUser(user));
});

module.exports = router;
