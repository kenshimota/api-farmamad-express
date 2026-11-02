const { Router } = require("express");
const { authenticate } = require("../auth/middleware");
const { authorize } = require("../auth/authorize");
const { validateRequest } = require("../auth/request-validator");
const { parseInvoiceId } = require("../invoices/parsers");
const { invoicePaymentService } = require("./service");
const {
  REQUIRED_INVOICE_PAYMENT_FIELDS,
  applyInvoicePaymentSchema,
  parseInvoicePaymentBody,
} = require("./validators");
const { toPublicAllocationWithInvoice } = require("./serializer");
const { handleInvoicePaymentError } = require("./errors");

const router = Router();

/**
 * Parses the invoice id before body validation so an invalid path answers 422
 * even when the payload is missing.
 * @param {import("express").Request} req - Express request.
 * @param {import("express").Response} res - Express response.
 * @param {import("express").NextFunction} next - Next middleware.
 * @returns {void}
 */
function validateInvoiceId(req, res, next) {
  const id = parseInvoiceId(req.params.id);

  if (id === null) {
    return res.status(422).json({ errors: { id: "Invalid invoice id" } });
  }

  req.invoiceId = id;

  return next();
}

/**
 * @openapi
 * /invoices/{id}/payments:
 *   post:
 *     summary: Applies a wallet payment to an invoice; admin and seller
 *     description: >
 *       Requires `payment_id` and `amount`. The payment must belong to the
 *       same customer as the invoice and the customer wallet must have enough
 *       balance in the payment currency. `exchange_rate` is the payment
 *       currency rate divided by the invoice currency rate and
 *       `applied_amount = round2(amount × exchange_rate)`. Inside one
 *       transaction the API locks the invoice, payment and wallet, creates the
 *       immutable allocation, debits the wallet, appends the
 *       `invoice_payment` movement and updates `paid_amount` and
 *       `payment_status` (`pending`, `partial`, `paid`). Applying a payment to
 *       an already paid invoice or repeating the pair answers 409.
 *     tags:
 *       - Invoices
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer, minimum: 1 }
 *         example: 1
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [payment_id, amount]
 *             properties:
 *               payment_id: { type: integer, minimum: 1, example: 1 }
 *               amount: { type: number, example: 25 }
 *     responses:
 *       201:
 *         description: Allocation created and the invoice updated
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/InvoicePaymentCreated' }
 *       400:
 *         description: Missing required fields
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorMessage' }
 *             example: { message: payment_id and amount are required }
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
 *         description: Invoice or payment does not exist
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorMessage' }
 *       409:
 *         description: Invoice already paid, duplicate allocation or insufficient wallet balance
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorMessage' }
 *             example: { message: Invoice is already paid }
 *       422:
 *         description: Invalid amount, another customer or amount above the invoice balance
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ValidationErrors' }
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post(
  "/:id/payments",
  authenticate,
  authorize("admin", "seller"),
  validateInvoiceId,
  validateRequest({
    schema: applyInvoicePaymentSchema,
    fields: REQUIRED_INVOICE_PAYMENT_FIELDS,
  }),
  async (req, res) => {
    try {
      const { allocation, invoice } = await invoicePaymentService.applyPayment(
        req.invoiceId,
        parseInvoicePaymentBody(req.validated),
        req.user.sub,
      );

      return res
        .status(201)
        .json(toPublicAllocationWithInvoice(allocation, invoice));
    } catch (error) {
      return handleInvoicePaymentError(error, res);
    }
  },
);

module.exports = router;
