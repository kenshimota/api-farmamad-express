const { Router } = require("express");
const { resolveQueryFilters } = require("../shared/query-filters");
const { toPublicPaymentTerm } = require("./serializer");
const { loadPaymentTerm } = require("./shared");
const { access } = require("./guards");
const { paymentTermService } = require("./service");
const { IS_ACTIVE_FILTER_MESSAGE, parseBooleanFlag } = require("./validators");

const router = Router();

const FILTER_SPECS = Object.freeze([
  {
    query: "is_active",
    field: "isActive",
    parse: parseBooleanFlag,
    message: IS_ACTIVE_FILTER_MESSAGE,
  },
]);

/**
 * @openapi
 * /payment-terms:
 *   get:
 *     summary: Lists payment terms; only administrators and sellers can do it
 *     description: >
 *       Returns every term ordered by `days` ascending and then `id`
 *       ascending. The optional `is_active=true|false` filter is exact.
 *     tags:
 *       - Payment terms
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: is_active
 *         schema: { type: boolean }
 *     responses:
 *       200:
 *         description: Terms ordered by days and id ascending
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items: { $ref: '#/components/schemas/PaymentTerm' }
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
 *             example: { errors: { is_active: Invalid is_active } }
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get("/", ...access(), async (req, res) => {
  const { filters, errors } = resolveQueryFilters(req.query, FILTER_SPECS);

  if (errors) {
    return res.status(422).json({ errors });
  }

  const terms = await paymentTermService.listPaymentTerms(filters);

  return res.json(terms.map((term) => toPublicPaymentTerm(term)));
});

/**
 * @openapi
 * /payment-terms/{id}:
 *   get:
 *     summary: Returns one payment term; only administrators and sellers can do it
 *     tags:
 *       - Payment terms
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer, minimum: 1 }
 *         example: 2
 *     responses:
 *       200:
 *         description: Public payment term data
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/PaymentTerm' }
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
 *         description: The payment term does not exist
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorMessage' }
 *             example: { message: Payment term not found }
 *       422:
 *         description: Invalid payment term id
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ValidationErrors' }
 *             example: { errors: { id: Invalid payment term id } }
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get("/:id", ...access(), loadPaymentTerm, (req, res) =>
  res.json(toPublicPaymentTerm(req.paymentTerm)),
);

module.exports = router;
