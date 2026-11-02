const { Router } = require("express");
const { authenticate } = require("../auth/middleware");
const { authorize } = require("../auth/authorize");
const { parsePositiveInteger } = require("../shared/parsers");
const { resolveQueryFilters } = require("../shared/query-filters");
const { toPublicPayment } = require("./serializer");
const { paymentService } = require("./service");
const { addDays, parseDateOnly } = require("./validators");
const { PAYMENT_STATUS_CODES } = require("./statuses");
const { parseListQuery, needsListOptions } = require("../shared/list-query");
const { sendListResponse } = require("../shared/pagination");

const router = Router();

const LIST_ORDER = Object.freeze([
  ["paid_at", "DESC"],
  ["id", "DESC"],
]);
const SORT_FIELDS = Object.freeze([
  "id",
  "paid_at",
  "amount",
  "status",
  "customer_id",
  "method_payment_id",
  "currency_id",
]);

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
  {
    query: "invoice_id",
    field: "invoiceId",
    parse: parsePositiveInteger,
    message: "Invalid invoice_id",
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

  if (query.status !== undefined) {
    if (!PAYMENT_STATUS_CODES.includes(query.status)) {
      return { errors: { status: "Invalid status" } };
    }

    filters.status = query.status;
  }

  if (query.paid_from !== undefined || query.from !== undefined) {
    const raw = query.paid_from ?? query.from;
    const paidFrom = parseDateOnly(raw);

    if (!paidFrom) {
      return {
        errors: {
          [query.paid_from !== undefined ? "paid_from" : "from"]:
            "Invalid from",
        },
      };
    }

    filters.paidFrom = paidFrom;
  }

  if (query.paid_to !== undefined || query.to !== undefined) {
    const raw = query.paid_to ?? query.to;
    const paidTo = parseDateOnly(raw);

    if (!paidTo) {
      return {
        errors: {
          [query.paid_to !== undefined ? "paid_to" : "to"]: "Invalid to",
        },
      };
    }

    filters.paidTo = addDays(paidTo, 1);
  }

  return { filters };
}

/**
 * Parses pagination, ordering and the free-text search of the payment listing.
 * @param {object} query - Express query object.
 * @returns {object} `{ errors }` or the list options.
 */
function resolveListOptions(query = {}) {
  return parseListQuery(query, {
    sortFields: SORT_FIELDS,
    defaultOrder: LIST_ORDER,
  });
}

/**
 * @openapi
 * /payments:
 *   get:
 *     summary: Lists received payments; admin and seller
 *     description: >
 *       Returns payments ordered by `paid_at` and `id` descending with their
 *       method, currency, status and reference image nested. Optional exact
 *       filters: `customer_id`, `method_payment_id`, `currency_id`,
 *       `status` (`pending`, `conciliated` or `rejected`), `paid_from` and
 *       `paid_to` in `YYYY-MM-DD` format.
 *     tags:
 *       - Payments
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - { in: query, name: customer_id, schema: { type: integer, minimum: 1 } }
 *       - { in: query, name: method_payment_id, schema: { type: integer, minimum: 1 } }
 *       - { in: query, name: currency_id, schema: { type: integer, minimum: 1 } }
 *       - { in: query, name: status, schema: { type: string, enum: [pending, conciliated, rejected] } }
 *       - { in: query, name: paid_from, schema: { type: string, format: date } }
 *       - { in: query, name: paid_to, schema: { type: string, format: date } }
 *       - { in: query, name: page, schema: { type: integer, minimum: 1, default: 1 } }
 *       - { in: query, name: page_size, schema: { type: integer, minimum: 1, maximum: 100, default: 20 } }
 *       - { in: query, name: sort, schema: { type: string } }
 *       - { in: query, name: order, schema: { type: string, enum: [asc, desc], default: asc } }
 *       - { in: query, name: q, schema: { type: string }, description: Partial case-insensitive search }
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
    const list = resolveListOptions(req.query);
    const errors = { ...query.errors, ...list.errors };

    if (Object.keys(errors).length > 0) {
      return res.status(422).json({ errors });
    }

    const filters = { ...query.filters };

    if (list.q !== undefined) {
      filters.q = list.q;
    }

    const payments = needsListOptions(list)
      ? await paymentService.listPayments(filters, {
          pagination: list.pagination,
          order: list.order,
        })
      : await paymentService.listPayments(filters);

    return sendListResponse(res, payments, (payment) =>
      toPublicPayment(payment),
    );
  },
);

module.exports = router;
module.exports.resolveListOptions = resolveListOptions;
module.exports.resolveListQuery = resolveListQuery;
