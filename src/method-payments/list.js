const { Router } = require("express");
const { toPublicMethodPayment } = require("./serializer");
const { loadMethodPayment } = require("./shared");
const { readAccess } = require("./guards");
const { methodPaymentService } = require("./service");
const { parseBooleanFlag, parsePositiveInteger } = require("./parsers");
const {
  CURRENCY_FILTER_MESSAGE,
  IS_ACTIVE_FILTER_MESSAGE,
  PAYMENT_TYPE_FILTER_MESSAGE,
} = require("./validators");
const { resolveQueryFilters } = require("../shared/query-filters");

const router = Router();

const LIST_FILTERS = Object.freeze([
  {
    query: "method_payment_type_id",
    field: "methodPaymentTypeId",
    parse: parsePositiveInteger,
    message: PAYMENT_TYPE_FILTER_MESSAGE,
  },
  {
    query: "currency_id",
    field: "currencyId",
    parse: parsePositiveInteger,
    message: CURRENCY_FILTER_MESSAGE,
  },
  {
    query: "is_active",
    field: "isActive",
    parse: parseBooleanFlag,
    message: IS_ACTIVE_FILTER_MESSAGE,
  },
]);

/**
 * Resolves the optional query filters.
 * @param {object} query - Express query object.
 * @returns {{ filters: object }|{ errors: Record<string, string> }} The
 *   service filters or the validation errors.
 */
function resolveListQuery(query) {
  return resolveQueryFilters(query, LIST_FILTERS);
}

/**
 * @openapi
 * /method-payments:
 *   get:
 *     summary: Lists payment methods; admin, seller and dispatcher
 *     description: >
 *       Returns every method ordered by `method_payment_type_id` and `label`
 *       ascending, including inactive rows, each one with its nested type and
 *       inherited currency. The exact filters `?method_payment_type_id=`,
 *       `?currency_id=` and `?is_active=true|false` narrow the result. The
 *       currency filter is resolved through the type include, without N+1.
 *     tags:
 *       - Method payments
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: method_payment_type_id
 *         required: false
 *         schema: { type: integer, minimum: 1 }
 *         example: 3
 *       - in: query
 *         name: currency_id
 *         required: false
 *         schema: { type: integer, minimum: 1 }
 *         example: 1
 *       - in: query
 *         name: is_active
 *         required: false
 *         schema: { type: boolean }
 *         example: true
 *     responses:
 *       200:
 *         description: Payment methods ordered by type and label
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items: { $ref: '#/components/schemas/MethodPayment' }
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
  const query = resolveListQuery(req.query);

  if (query.errors) {
    return res.status(422).json({ errors: query.errors });
  }

  const methods = await methodPaymentService.listMethodPayments(query.filters);

  return res.json(methods.map((method) => toPublicMethodPayment(method)));
});

/**
 * @openapi
 * /method-payments/{id}:
 *   get:
 *     summary: Returns one payment method; admin, seller and dispatcher
 *     description: Inactive methods can also be read by id.
 *     tags:
 *       - Method payments
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
 *         description: Public payment method data
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/MethodPayment' }
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
 *         description: The payment method does not exist
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorMessage' }
 *             example: { message: Payment method not found }
 *       422:
 *         description: Invalid payment method id
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ValidationErrors' }
 *             example: { errors: { id: Invalid payment method id } }
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get("/:id", ...readAccess(), loadMethodPayment, (req, res) =>
  res.json(toPublicMethodPayment(req.methodPayment)),
);

module.exports = router;
