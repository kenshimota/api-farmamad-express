const { Router } = require("express");
const { authenticate } = require("../auth/middleware");
const { authorize } = require("../auth/authorize");
const { parsePositiveInteger } = require("../shared/parsers");
const { resolveQueryFilters } = require("../shared/query-filters");
const { toPublicPayment } = require("./serializer");
const { paymentService } = require("./service");
const { addDays, parseDateOnly } = require("./validators");

const router = Router();

const ID_FILTERS = Object.freeze([
  {
    query: "customer_id",
    field: "customerId",
    parse: parsePositiveInteger,
    message: "Invalid customer_id",
  },
  {
    query: "method_payment_id",
    field: "methodPaymentId",
    parse: parsePositiveInteger,
    message: "Invalid method_payment_id",
  },
  {
    query: "currency_id",
    field: "currencyId",
    parse: parsePositiveInteger,
    message: "Invalid currency_id",
  },
]);

/**
 * Resolves the optional query filters, including the paid date range. A plain
 * `YYYY-MM-DD` upper bound is turned into the exclusive start of the next day.
 * @param {object} query - Express query object.
 * @returns {{ filters: object }|{ errors: Record<string, string> }} The
 *   service filters or the validation errors.
 */
function resolveListQuery(query = {}) {
  const resolved = resolveQueryFilters(query, ID_FILTERS);

  if (resolved.errors) {
    return resolved;
  }

  const { filters } = resolved;

  if (query.paid_from !== undefined) {
    const paidFrom = parseDateOnly(query.paid_from);

    if (!paidFrom) {
      return { errors: { paid_from: "Invalid paid_from" } };
    }

    filters.paidFrom = paidFrom;
  }

  if (query.paid_to !== undefined) {
    const paidTo = parseDateOnly(query.paid_to);

    if (!paidTo) {
      return { errors: { paid_to: "Invalid paid_to" } };
    }

    filters.paidTo = addDays(paidTo, 1);
  }

  return { filters };
}

/**
 * @openapi
 * /payments:
 *   get:
 *     summary: Lists received payments; admin and seller
 *     description: >
 *       Returns payments ordered by `paid_at` and `id` descending with their
 *       method and currency nested. Optional exact filters: `customer_id`,
 *       `method_payment_id`, `currency_id`, `paid_from` and `paid_to` in
 *       `YYYY-MM-DD` format.
 *     tags:
 *       - Payments
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - { in: query, name: customer_id, schema: { type: integer, minimum: 1 } }
 *       - { in: query, name: method_payment_id, schema: { type: integer, minimum: 1 } }
 *       - { in: query, name: currency_id, schema: { type: integer, minimum: 1 } }
 *       - { in: query, name: paid_from, schema: { type: string, format: date } }
 *       - { in: query, name: paid_to, schema: { type: string, format: date } }
 *     responses:
 *       200:
 *         description: Payments newest first
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items: { $ref: '#/components/schemas/Payment' }
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
 *         $ref: '#/components/responses/NotFound'
 *       422:
 *         description: Invalid filter
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ValidationErrors' }
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get(
  "/",
  authenticate,
  authorize("admin", "seller"),
  async (req, res) => {
    const query = resolveListQuery(req.query);

    if (query.errors) {
      return res.status(422).json({ errors: query.errors });
    }

    const payments = await paymentService.listPayments(query.filters);

    return res.json(payments.map((payment) => toPublicPayment(payment)));
  },
);

module.exports = router;
module.exports.resolveListQuery = resolveListQuery;
