const { Router } = require("express");
const { authenticate } = require("../auth/middleware");
const { authorize } = require("../auth/authorize");
const { isStaff, loadCurrentUser } = require("../shared/customer-access");
const { toPublicWalletTransaction } = require("./serializer");
const { loadWallet } = require("./shared");
const { walletService } = require("./service");

const router = Router();

/**
 * @openapi
 * /customer-wallets/{id}/transactions:
 *   get:
 *     summary: Lists the append-only movements of a wallet; staff or its owner
 *     description: >
 *       Returns the movements ordered by `createdAt` and `id` descending.
 *       Each row includes `transaction_type`, `amount`, `balance_after`, the
 *       wallet currency, `payment_id`, `invoice_id`,
 *       `payment_allocation_id`, `description` and `created_at`. Staff also
 *       see `created_by` with `id`, `username` and `email`; the customer does
 *       not. Another customer's wallet answers 404.
 *     tags:
 *       - Customer wallets
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer, minimum: 1 }
 *         example: 5
 *     responses:
 *       200:
 *         description: Movements newest first
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items: { $ref: '#/components/schemas/WalletTransaction' }
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
 *         description: The wallet does not exist or belongs to another customer
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorMessage' }
 *       422:
 *         description: Invalid wallet id
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ValidationErrors' }
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get(
  "/:id/transactions",
  authenticate,
  authorize("admin", "seller", "customer"),
  loadCurrentUser,
  loadWallet,
  async (req, res) => {
    const includeCreatedBy = isStaff(req.currentUser);
    const transactions = await walletService.listTransactions(req.wallet.id, {
      includeCreatedBy,
    });

    return res.json(
      transactions.map((transaction) =>
        toPublicWalletTransaction(transaction, { includeCreatedBy }),
      ),
    );
  },
);

module.exports = router;
