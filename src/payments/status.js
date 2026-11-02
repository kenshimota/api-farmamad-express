const { Router } = require("express");
const { authenticate } = require("../auth/middleware");
const { authorize } = require("../auth/authorize");
const { validateRequest } = require("../auth/request-validator");
const { loadPayment } = require("./shared");
const { handlePaymentError } = require("./errors");
const {
  toPublicHistoryEvent,
  toPublicPaymentWithWallet,
} = require("./serializer");
const { changePaymentStatusSchema } = require("./status-validators");
const { paymentStatusService } = require("./status-service");

const router = Router();
const REQUIRED_STATUS_FIELDS = Object.freeze(["status"]);

/**
 * @openapi
 * /payments/{id}/status:
 *   put:
 *     summary: Conciliates or rejects a pending payment; admin and seller
 *     description: >
 *       Only `pending → conciliated` and `pending → rejected` are allowed;
 *       `conciliated` and `rejected` are terminal. The payment row is locked
 *       with `FOR UPDATE`. Conciliating creates or locks the wallet, increments
 *       its balance and appends exactly one `deposit` movement in the same
 *       transaction; a concurrent second call answers 422 without a second
 *       credit. Rejecting requires a trimmed reason of 3–500 characters,
 *       stores it in `rejection_reason` and never touches the wallet.
 *     tags:
 *       - Payments
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer, minimum: 1 }
 *         example: 10
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [status]
 *             properties:
 *               status: { type: string, enum: [conciliated, rejected] }
 *               reason: { type: string, maxLength: 500 }
 *     responses:
 *       202:
 *         description: Status changed; wallet is null for a rejection
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/PaymentWithWallet' }
 *       400:
 *         description: Missing status
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorMessage' }
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
 *         description: The payment does not exist
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorMessage' }
 *       422:
 *         description: Invalid status, transition or rejection reason
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ValidationErrors' }
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.put(
  "/:id/status",
  authenticate,
  authorize("admin", "seller"),
  loadPayment,
  validateRequest({
    schema: changePaymentStatusSchema,
    fields: REQUIRED_STATUS_FIELDS,
  }),
  async (req, res) => {
    try {
      const { payment, wallet } = await paymentStatusService.changeStatus(
        req.payment.id,
        req.validated,
        req.user.sub,
      );

      return res.status(202).json(toPublicPaymentWithWallet(payment, wallet));
    } catch (error) {
      return handlePaymentError(error, res);
    }
  },
);

/**
 * @openapi
 * /payments/{id}/history:
 *   get:
 *     summary: Returns the append-only status history of a payment; admin and seller
 *     description: >
 *       Events are ordered by `createdAt` and `id` ascending. Each event has
 *       `from_status`, `to_status`, `reason`, `created_at` and the `actor`
 *       (`id`, `username`, `email`). There are no endpoints to edit or delete
 *       events.
 *     tags:
 *       - Payments
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer, minimum: 1 }
 *         example: 10
 *     responses:
 *       200:
 *         description: Status events oldest first
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items: { $ref: '#/components/schemas/PaymentHistoryEvent' }
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
 *         description: The payment does not exist
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorMessage' }
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get(
  "/:id/history",
  authenticate,
  authorize("admin", "seller"),
  loadPayment,
  async (req, res) => {
    const history = await paymentStatusService.listHistory(req.payment.id);

    return res.json(history.map((event) => toPublicHistoryEvent(event)));
  },
);

module.exports = router;
