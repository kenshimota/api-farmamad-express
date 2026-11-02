const { Router } = require("express");
const { authenticate } = require("../auth/middleware");
const { authorize } = require("../auth/authorize");
const {
  loadCurrentUser,
  resolveCustomerScope,
} = require("../shared/customer-access");
const { toPublicWallet } = require("./serializer");
const { parseCustomerId } = require("./parsers");
const { walletService } = require("./service");

const router = Router();

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
    const raw = req.query.customer_id;
    const parsed = raw === undefined ? undefined : parseCustomerId(raw);

    if (parsed === null) {
      return res.status(422).json({
        errors: { customer_id: "Invalid customer_id" },
      });
    }

    const scope = resolveCustomerScope(req.currentUser, parsed);

    if (scope.body) {
      return res.status(scope.status).json(scope.body);
    }

    const wallets = await walletService.listWallets(scope.customerId);

    return res.json(wallets.map((wallet) => toPublicWallet(wallet)));
  },
);

module.exports = router;
