const { Router } = require("express");
const { parseInvoiceId } = require("../invoices/parsers");
const { detailAccess } = require("../invoices/guards");
const { handleInvoiceError } = require("../invoices/shared");
const { parsePositiveInteger } = require("../shared/parsers");
const { sendHttpError } = require("../shared/http-error");
const { equivalenceService } = require("./service");
const { invalidCurrencyId, invalidInvoiceId } = require("./errors");

const router = Router();

/**
 * @openapi
 * /invoices/{id}/equivalence:
 *   get:
 *     summary: Returns the read-only equivalent of an invoice in another currency
 *     description: >
 *       Converts the invoice header (`subtotal`, `tax_amount`, `total`,
 *       `paid_amount`, `balance_due`) and its snapshot lines using the current
 *       `currencies.rate`, never a historical rate. `currency_id` is optional;
 *       when omitted the target is the base currency (`is_base = true`,
 *       normally VES). `payment.amount_due_source` is the invoice balance
 *       (`total - paid_amount`), not the total. The response does not create,
 *       update or delete any invoice, payment, wallet or stock row and never
 *       exposes wallet balances. Conversion:
 *       `exchange_rate = round6(source.rate / target.rate)` and
 *       `target = round2(source × exchange_rate)`.
 *     tags:
 *       - Invoices
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer, minimum: 1 }
 *         example: 7
 *       - in: query
 *         name: currency_id
 *         required: false
 *         schema: { type: integer, minimum: 1 }
 *         description: Active target currency; defaults to the base currency
 *         example: 1
 *     responses:
 *       200:
 *         description: Invoice amounts in the source and target currencies
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 resource: { type: string, example: invoice }
 *                 exchange_rate: { type: number, example: 889.89 }
 *                 rounding_adjustment: { type: number, example: 0 }
 *                 rate_source: { type: string, example: currencies.rate }
 *                 calculated_at: { type: string, format: date-time }
 *                 source: { type: object }
 *                 target: { type: object }
 *                 payment_term: { type: object, nullable: true }
 *                 payment: { type: object }
 *                 lines: { type: array, items: { type: object } }
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
 *         description: Invoice not found or hidden from the customer, or unknown currency
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorMessage' }
 *       422:
 *         description: Invalid invoice id, currency_id or inactive target currency
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ValidationErrors' }
 *       503:
 *         description: Missing base currency or an invalid/missing rate
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorMessage' }
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get("/:id/equivalence", ...detailAccess(), async (req, res) => {
  const id = parseInvoiceId(req.params.id);

  if (id === null) {
    return sendHttpError(res, invalidInvoiceId());
  }

  let currencyId;

  if (req.query.currency_id !== undefined) {
    currencyId = parsePositiveInteger(req.query.currency_id);

    if (currencyId === null) {
      return sendHttpError(res, invalidCurrencyId());
    }
  }

  try {
    return res.json(
      await equivalenceService.getInvoiceEquivalence(id, req.user, currencyId),
    );
  } catch (error) {
    return handleInvoiceError(error, res);
  }
});

module.exports = router;
