const { Router } = require("express");
const { authenticate } = require("../auth/middleware");
const { authorize } = require("../auth/authorize");
const { parseInvoiceId } = require("../invoices/parsers");
const { invoicePaymentService } = require("./service");
const { toPublicAllocation } = require("./serializer");
const { handleInvoicePaymentError } = require("./errors");

const router = Router();

/**
 * @openapi
 * /invoices/{id}/payments:
 *   get:
 *     summary: Lists the payments applied to an invoice; staff or its owner
 *     description: >
 *       Returns the immutable allocations ordered by `allocated_at` ascending
 *       and then `id` ascending. Each row includes the payment amount and
 *       currency, the applied amount in the invoice currency, the exchange
 *       rate, the allocation timestamp, `method_payment` and
 *       `method_payment_type`. `created_by` is only present for `admin` and
 *       `seller`. A customer can only read a own invoice; another invoice
 *       answers 404. Wallet balances are never exposed.
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
 *     responses:
 *       200:
 *         description: Allocations ordered by allocation time and id
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items: { $ref: '#/components/schemas/PaymentAllocation' }
 *       401:
 *         description: Missing, invalid or expired token
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorMessage' }
 *       403:
 *         description: Role without permission, blocked user or unlinked customer
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorMessage' }
 *       404:
 *         description: The invoice does not exist or belongs to another customer
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorMessage' }
 *             example: { message: Invoice not found }
 *       422:
 *         description: Invalid invoice id
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ValidationErrors' }
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get(
  "/:id/payments",
  authenticate,
  authorize("admin", "seller", "customer"),
  async (req, res) => {
    const id = parseInvoiceId(req.params.id);

    if (id === null) {
      return res.status(422).json({ errors: { id: "Invalid invoice id" } });
    }

    try {
      const includeCreatedBy = ["admin", "seller"].includes(req.user.role);
      const allocations = await invoicePaymentService.listInvoicePayments(
        id,
        req.user,
      );

      return res.json(
        allocations.map((allocation) =>
          toPublicAllocation(allocation, { includeCreatedBy }),
        ),
      );
    } catch (error) {
      return handleInvoicePaymentError(error, res);
    }
  },
);

module.exports = router;
