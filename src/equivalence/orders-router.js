const { Router } = require("express");
const { parsePositiveId } = require("../orders/parsers");
const { orderAccess } = require("../orders/guards");
const { handleOrderError } = require("../orders/shared");
const { parsePositiveInteger } = require("../shared/parsers");
const { sendHttpError } = require("../shared/http-error");
const { equivalenceService } = require("./service");
const { invalidCurrencyId, invalidOrderId } = require("./errors");

const router = Router();

/**
 * @openapi
 * /orders/{id}/equivalence:
 *   get:
 *     summary: Returns the read-only equivalent of an order in another currency
 *     description: >
 *       Converts the stored order amounts using the current
 *       `currencies.rate`, never a historical rate. `currency_id` is optional;
 *       when omitted the target is the base currency (`is_base = true`,
 *       normally VES). The response does not create, update or delete any
 *       order, line, stock, lot or wallet row. Costs, lots, locations and
 *       wallet balances are never exposed. Conversion:
 *       `exchange_rate = round6(source.rate / target.rate)`,
 *       `target = round2(source × exchange_rate)` and line
 *       `subtotal_target = round2(quantity × unit_price_target)`.
 *     tags:
 *       - Orders
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer, minimum: 1 }
 *         example: 10
 *       - in: query
 *         name: currency_id
 *         required: false
 *         schema: { type: integer, minimum: 1 }
 *         description: Active target currency; defaults to the base currency
 *         example: 1
 *     responses:
 *       200:
 *         description: Order amounts in the source and target currencies
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 resource: { type: string, example: order }
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
 *         description: Order not found or hidden from the customer, or unknown currency
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorMessage' }
 *       422:
 *         description: Invalid order id, currency_id or inactive target currency
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
router.get("/:id/equivalence", ...orderAccess(), async (req, res) => {
  const id = parsePositiveId(req.params.id);

  if (id === null) {
    return sendHttpError(res, invalidOrderId());
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
      await equivalenceService.getOrderEquivalence(id, req.user, currencyId),
    );
  } catch (error) {
    return handleOrderError(error, res);
  }
});

module.exports = router;
