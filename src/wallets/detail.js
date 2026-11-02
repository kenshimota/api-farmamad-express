const { Router } = require("express");
const { authenticate } = require("../auth/middleware");
const { authorize } = require("../auth/authorize");
const { loadCurrentUser } = require("../shared/customer-access");
const { toPublicWallet } = require("./serializer");
const { loadWallet } = require("./shared");

const router = Router();

/**
 * @openapi
 * /customer-wallets/{id}:
 *   get:
 *     summary: Returns one wallet; staff or its owner
 *     description: A customer can only read its own wallet; another wallet answers 404.
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
 *         description: Public wallet data
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/CustomerWallet' }
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
 *             example: { message: Wallet not found }
 *       422:
 *         description: Invalid wallet id
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ValidationErrors' }
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get(
  "/:id",
  authenticate,
  authorize("admin", "seller", "customer"),
  loadCurrentUser,
  loadWallet,
  (req, res) => res.json(toPublicWallet(req.wallet)),
);

module.exports = router;
