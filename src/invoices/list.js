const { Router } = require("express");
const { resolveQueryFilters } = require("../shared/query-filters");
const { toPublicInvoice } = require("./serializer");
const { readAccess } = require("./guards");
const { invoiceService } = require("./service");
const {
  CUSTOMER_FILTER_MESSAGE,
  NUMBER_FILTER_MESSAGE,
  ORDER_FILTER_MESSAGE,
  PAYMENT_STATUS_MESSAGE,
  parseCustomerFilter,
  parseNumberFilter,
  parseOrderFilter,
  parsePaymentStatusFilter,
} = require("./parsers");

const router = Router();

const FILTER_SPECS = Object.freeze([
  {
    query: "order_id",
    field: "orderId",
    parse: parseOrderFilter,
    message: ORDER_FILTER_MESSAGE,
  },
  {
    query: "customer_id",
    field: "customerId",
    parse: parseCustomerFilter,
    message: CUSTOMER_FILTER_MESSAGE,
  },
  {
    query: "number",
    field: "number",
    parse: parseNumberFilter,
    message: NUMBER_FILTER_MESSAGE,
  },
  {
    query: "payment_status",
    field: "paymentStatus",
    parse: parsePaymentStatusFilter,
    message: PAYMENT_STATUS_MESSAGE,
  },
]);

/**
 * @openapi
 * /invoices:
 *   get:
 *     summary: Lists invoices; only administrators and sellers can do it
 *     description: >
 *       Returns invoice summaries ordered by `issued_at` descending and then
 *       `id` descending. Optional exact filters: `order_id`, `customer_id`,
 *       `number` and `payment_status` (`pending`, `partial`, `paid`). Lines
 *       are not included in this listing; use `GET /invoices/{id}`.
 *     tags:
 *       - Invoices
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: order_id
 *         schema: { type: integer, minimum: 1 }
 *       - in: query
 *         name: customer_id
 *         schema: { type: integer, minimum: 1 }
 *       - in: query
 *         name: number
 *         schema: { type: integer, minimum: 1 }
 *       - in: query
 *         name: payment_status
 *         schema: { type: string, enum: [pending, partial, paid] }
 *     responses:
 *       200:
 *         description: Invoice summaries ordered by issue date descending
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Invoice'
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
router.get("/", ...readAccess(), async (req, res) => {
  const { filters, errors } = resolveQueryFilters(req.query, FILTER_SPECS);

  if (errors) {
    return res.status(422).json({ errors });
  }

  const invoices = await invoiceService.listInvoices(filters);

  return res.json(invoices.map((invoice) => toPublicInvoice(invoice)));
});

module.exports = router;
