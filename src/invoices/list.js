const { Router } = require("express");
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
const {
  parseListQuery,
  parseDateOnly,
  needsListOptions,
} = require("../shared/list-query");
const { sendListResponse } = require("../shared/pagination");

const router = Router();

const SORT_FIELDS = Object.freeze([
  "id",
  "number",
  "issued_at",
  "due_date",
  "total",
  "customer_id",
  "order_id",
  "payment_status",
]);

const STATUS_MESSAGE = PAYMENT_STATUS_MESSAGE;

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
    query: "status",
    field: "paymentStatus",
    parse: parsePaymentStatusFilter,
    message: STATUS_MESSAGE,
  },
  {
    query: "payment_status",
    field: "paymentStatus",
    parse: parsePaymentStatusFilter,
    message: PAYMENT_STATUS_MESSAGE,
  },
  {
    query: "from",
    field: "from",
    parse: parseDateOnly,
    message: "Invalid from",
  },
  {
    query: "to",
    field: "to",
    parse: parseDateOnly,
    message: "Invalid to",
  },
  {
    query: "due_from",
    field: "dueFrom",
    parse: parseDateOnly,
    message: "Invalid due_from",
  },
  {
    query: "due_to",
    field: "dueTo",
    parse: parseDateOnly,
    message: "Invalid due_to",
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
 *       - { in: query, name: page, schema: { type: integer, minimum: 1, default: 1 } }
 *       - { in: query, name: page_size, schema: { type: integer, minimum: 1, maximum: 100, default: 20 } }
 *       - { in: query, name: sort, schema: { type: string } }
 *       - { in: query, name: order, schema: { type: string, enum: [asc, desc], default: asc } }
 *       - { in: query, name: q, schema: { type: string }, description: Partial case-insensitive search }
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
  const query = parseListQuery(req.query, {
    filters: FILTER_SPECS,
    sortFields: SORT_FIELDS,
    defaultOrder: [
      ["issued_at", "DESC"],
      ["id", "DESC"],
    ],
  });

  if (query.errors) {
    return res.status(422).json({ errors: query.errors });
  }

  const filters = { ...query.filters };

  if (query.q !== undefined) {
    filters.q = query.q;
  }

  const invoices = needsListOptions(query)
    ? await invoiceService.listInvoices(filters, {
        pagination: query.pagination,
        order: query.order,
      })
    : await invoiceService.listInvoices(filters);

  return sendListResponse(res, invoices, (invoice) => toPublicInvoice(invoice));
});

module.exports = router;
