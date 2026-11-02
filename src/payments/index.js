const { Router } = require("express");
const { authenticate } = require("../auth/middleware");
const { authorize } = require("../auth/authorize");
const { validateRequest } = require("../auth/request-validator");
const { REQUIRED_PAYMENT_FIELDS } = require("./fields");
const { createPaymentSchema } = require("./validators");
const { toPublicPaymentWithWallet } = require("./serializer");
const { paymentService } = require("./service");
const { handlePaymentError } = require("./errors");
const { uploadSingleImage } = require("../products/upload");
const listRouter = require("./list");
const detailRouter = require("./detail");
const updateRouter = require("./update");
const removeRouter = require("./remove");
const statusRouter = require("./status");

const router = Router();

/**
 * @openapi
 * /payments:
 *   post:
 *     summary: Registers a received payment in pending; admin and seller
 *     description: >
 *       Requires `customer_id`, `method_payment_id` and `amount`. The currency
 *       is copied from `method_payment_types.currency_id`; `currency_id` in the
 *       body is ignored. The customer and the method must exist, and the method,
 *       its type and its currency must be active. A new payment is `pending`
 *       and does not touch the wallet: the balance is credited only when
 *       `PUT /payments/{id}/status` conciliates it. Accepts JSON or
 *       multipart/form-data with an optional `image` file (JPEG, PNG or WebP,
 *       maximum 5 MB) stored under `uploads/payments` with a WebP thumbnail.
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
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [customer_id, method_payment_id, amount]
 *             properties:
 *               customer_id: { type: integer, minimum: 1, example: 8 }
 *               method_payment_id: { type: integer, minimum: 1, example: 3 }
 *               amount: { type: number, example: 100 }
 *               paid_at: { type: string, format: date-time }
 *               reference: { type: string, maxLength: 100 }
 *               notes: { type: string, maxLength: 1000 }
 *               image: { type: string, format: binary }
 *     responses:
 *       201:
 *         description: Pending payment created; the wallet is null
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
 *       413:
 *         description: The image exceeds 5 MB
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorMessage' }
 *       422:
 *         description: Invalid amount, unusable payment method or invalid image
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
  uploadSingleImage,
  validateRequest({
    schema: createPaymentSchema,
    fields: REQUIRED_PAYMENT_FIELDS,
  }),
  async (req, res) => {
    try {
      const { payment, wallet } = req.file
        ? await paymentService.createPayment(req.validated, req.user.sub, {
            file: req.file,
          })
        : await paymentService.createPayment(req.validated, req.user.sub);

      return res.status(201).json(toPublicPaymentWithWallet(payment, wallet));
    } catch (error) {
      return handlePaymentError(error, res);
    }
  },
);

router.use(listRouter);
router.use(statusRouter);
router.use(detailRouter);
router.use(updateRouter);
router.use(removeRouter);

module.exports = router;
