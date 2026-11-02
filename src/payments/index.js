const { Router } = require("express");
const { authenticate } = require("../auth/middleware");
const { authorize } = require("../auth/authorize");
const { validateRequest } = require("../auth/request-validator");
const { REQUIRED_PAYMENT_FIELDS } = require("./fields");
const { createPaymentSchema } = require("./validators");
const { toPublicPaymentWithWallet } = require("./serializer");
const { paymentService } = require("./service");
const { handlePaymentError } = require("./errors");
const listRouter = require("./list");
const detailRouter = require("./detail");
const updateRouter = require("./update");
const removeRouter = require("./remove");

const router = Router();

/**
 * @openapi
 * /payments:
 *   post:
 *     summary: Registers a received payment and credits the wallet; admin and seller
 *     description: >
 *       Requires `customer_id`, `method_payment_id` and `amount`. The currency
 *       is copied from `method_payment_types.currency_id`; `currency_id` in the
 *       body is ignored. The customer and the method must exist, and the method,
 *       its type and its currency must be active. Inside one transaction the API
 *       locks or creates the `(customer_id, currency_id)` wallet, increments its
 *       balance, creates the payment and appends the `deposit` movement with
 *       `balance_after`.
 *     tags:
 *       - Payments
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [customer_id, method_payment_id, amount]
 *             properties:
 *               customer_id: { type: integer, minimum: 1, example: 8 }
 *               method_payment_id: { type: integer, minimum: 1, example: 3 }
 *               amount: { type: number, example: 100 }
 *               paid_at: { type: string, format: date-time, example: '2026-11-01T12:00:00.000Z' }
 *               reference: { type: string, maxLength: 100, example: TRX-123 }
 *               notes: { type: string, maxLength: 1000, example: Depósito Binance }
 *     responses:
 *       201:
 *         description: Payment created and wallet credited
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/PaymentWithWallet' }
 *       400:
 *         description: Missing required fields
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorMessage' }
 *             example: { message: customer_id, method_payment_id and amount are required }
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
 *         description: Customer or payment method does not exist
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorMessage' }
 *       422:
 *         description: Invalid amount or unusable payment method
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ValidationErrors' }
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post(
  "/",
  authenticate,
  authorize("admin", "seller"),
  validateRequest({
    schema: createPaymentSchema,
    fields: REQUIRED_PAYMENT_FIELDS,
  }),
  async (req, res) => {
    try {
      const { payment, wallet } = await paymentService.createPayment(
        req.validated,
        req.user.sub,
      );

      return res.status(201).json(toPublicPaymentWithWallet(payment, wallet));
    } catch (error) {
      return handlePaymentError(error, res);
    }
  },
);

router.use(listRouter);
router.use(detailRouter);
router.use(updateRouter);
router.use(removeRouter);

module.exports = router;
