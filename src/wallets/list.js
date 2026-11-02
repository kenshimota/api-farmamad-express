const { Router } = require("express");
const { authenticate } = require("../auth/middleware");
const { authorize } = require("../auth/authorize");
const {
  loadCurrentUser,
  resolveCustomerScope,
} = require("../shared/customer-access");
const { toPublicWallet } = require("./serializer");
const { walletService } = require("./service");
const { parsePositiveInteger } = require("../shared/parsers");
const { parseListQuery, needsListOptions } = require("../shared/list-query");
const { sendListResponse } = require("../shared/pagination");

const router = Router();

const SORT_FIELDS = Object.freeze(["id", "currency_id", "customer_id"]);
const FILTER_SPECS = Object.freeze([
  {
    query: "customer_id",
    field: "customerId",
    parse: parsePositiveInteger,
    message: "Invalid customer_id",
  },
]);

/**
 * @openapi
 * /customer-wallets:
 *   get:
 *     summary: Lists the wallets of a customer; staff or the customer itself
 *     description: >
 *       `admin` and `seller` must send `?customer_id=`; a `customer` always
 *       sees its own wallets and may omit the parameter. Each wallet includes
 *       its currency and current balance.
 *     tags:
 *       - Customer wallets
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: customer_id
 *         required: false
 *         schema: { type: integer, minimum: 1 }
 *         example: 8
 *       - { in: query, name: page, schema: { type: integer, minimum: 1, default: 1 } }
 *       - { in: query, name: page_size, schema: { type: integer, minimum: 1, maximum: 100, default: 20 } }
 *       - { in: query, name: sort, schema: { type: string } }
 *       - { in: query, name: order, schema: { type: string, enum: [asc, desc], default: asc } }
 *       - { in: query, name: q, schema: { type: string }, description: Partial case-insensitive search }
 *     responses:
 *       200:
 *         description: Wallets ordered by currency id
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items: { $ref: '#/components/schemas/CustomerWallet' }
 *       400:
 *         description: Staff requests without customer_id
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorMessage' }
 *             example: { message: customer_id is required }
 *       401:
 *         description: Missing, invalid or expired token
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorMessage' }
 *       403:
 *         description: Role without permission, unlinked customer or another customer
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorMessage' }
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       422:
 *         description: Invalid customer_id
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ValidationErrors' }
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get(
  "/",
  authenticate,
  authorize("admin", "seller", "customer"),
  loadCurrentUser,
  async (req, res) => {
    const query = parseListQuery(req.query, {
      filters: FILTER_SPECS,
      sortFields: SORT_FIELDS,
      defaultOrder: [["currency_id", "ASC"]],
    });

    if (query.errors) {
      return res.status(422).json({ errors: query.errors });
    }

    const parsed = query.filters.customerId;
    const scope = resolveCustomerScope(req.currentUser, parsed);

    if (scope.body) {
      return res.status(scope.status).json(scope.body);
    }

    const wallets = needsListOptions(query)
      ? await walletService.listWallets(scope.customerId, {
          pagination: query.pagination,
          order: query.order,
        })
      : await walletService.listWallets(scope.customerId);

    return sendListResponse(res, wallets, (wallet) => toPublicWallet(wallet));
  },
);

module.exports = router;
