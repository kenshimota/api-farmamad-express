const { Router } = require("express");
const { authenticate } = require("../auth/middleware");
const { authorize } = require("../auth/authorize");
const { loadCurrentUser } = require("../shared/customer-access");
const { toPublicPayment } = require("./serializer");
const { loadPayment } = require("./shared");

const router = Router();

/**
 * @openapi
 * /payments/{id}:
 *   get:
 *     summary: Returns one payment; admin, seller or its owner
 *     description: A customer can only read its own payments; another payment answers 404.
 *     tags:
 *       - Payments
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer, minimum: 1 }
 *         example: 1
 *     responses:
 *       200:
 *         description: Public payment data
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Payment' }
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
 *         description: The payment does not exist or belongs to another customer
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorMessage' }
 *       422:
 *         description: Invalid payment id
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
  loadPayment,
  (req, res) => res.json(toPublicPayment(req.payment)),
);

module.exports = router;
