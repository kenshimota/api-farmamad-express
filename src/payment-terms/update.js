const { Router } = require("express");
const { toPublicPaymentTerm } = require("./serializer");
const { updatePaymentTermSchema } = require("./validators");
const { UPDATE_PAYMENT_TERM_FIELDS } = require("./fields");
const { loadPaymentTerm } = require("./shared");
const { access, requireAnyField, validatedBody } = require("./guards");
const { paymentTermService } = require("./service");
const { handlePaymentTermError } = require("./errors");

const router = Router();

/**
 * @openapi
 * /payment-terms/{id}:
 *   put:
 *     summary: Updates a payment term; only administrators and sellers can do it
 *     description: >
 *       Replaces `name`, `description`, `days` and `is_active`; `code` is
 *       immutable and any value sent for it is ignored. A successful update
 *       responds 202 with the updated resource.
 *     tags:
 *       - Payment terms
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer, minimum: 1 }
 *         example: 4
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string, maxLength: 100, example: Crédito 45 días }
 *               description:
 *                 type: string
 *                 maxLength: 255
 *                 nullable: true
 *                 example: Pago a 45 días
 *               days: { type: integer, minimum: 0, maximum: 3650, example: 45 }
 *               is_active: { type: boolean, example: false }
 *     responses:
 *       202:
 *         description: Updated payment term
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/PaymentTerm' }
 *       400:
 *         description: No editable field was provided
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorMessage' }
 *             example: { message: At least one field is required }
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
 *       409:
 *         description: The code collides with another term
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorMessage' }
 *       422:
 *         description: Invalid payment term id or fields
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ValidationErrors' }
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.put(
  "/:id",
  ...access(),
  ...validatedBody(updatePaymentTermSchema, []),
  requireAnyField(UPDATE_PAYMENT_TERM_FIELDS),
  loadPaymentTerm,
  async (req, res) => {
    try {
      await paymentTermService.updatePaymentTerm(
        req.paymentTerm,
        req.validated,
      );

      return res.status(202).json(toPublicPaymentTerm(req.paymentTerm));
    } catch (error) {
      return handlePaymentTermError(error, res);
    }
  },
);

module.exports = router;
