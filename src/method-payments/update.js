const { Router } = require("express");
const { toPublicMethodPayment } = require("./serializer");
const { loadMethodPayment } = require("./shared");
const { requireAnyField, validatedBody, writeAccess } = require("./guards");
const { UPDATE_METHOD_PAYMENT_FIELDS } = require("./fields");
const { updateMethodPaymentSchema } = require("./validators");
const { methodPaymentService } = require("./service");
const { handleMethodPaymentError } = require("./errors");

const router = Router();

/**
 * @openapi
 * /method-payments/{id}:
 *   put:
 *     summary: Updates a payment method; only administrators can do it
 *     description: >
 *       Updates `label`, `details` and `is_active`; at least one of them is
 *       required. `method_payment_type_id` is immutable: sending another value
 *       answers 422. `currency_id` and `currency` are ignored because the
 *       currency always comes from the type. `details` is revalidated against
 *       the current type inside a transaction. Reactivating (`is_active =
 *       true`) requires the type and its currency to be active. A successful
 *       update responds 202.
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
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               label: { type: string, maxLength: 100, example: PayPal principal }
 *               details:
 *                 type: object
 *                 additionalProperties: true
 *                 example: { email: tesoreria@farmamad.com }
 *               is_active: { type: boolean, example: true }
 *     responses:
 *       202:
 *         description: Updated public payment method data
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/MethodPayment' }
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
 *         description: The payment method does not exist
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorMessage' }
 *             example: { message: Payment method not found }
 *       409:
 *         description: The label already exists inside the type
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorMessage' }
 *             example: { message: Payment method already exists }
 *       422:
 *         description: Invalid id, details or payment type change
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ValidationErrors' }
 *             examples:
 *               immutable: { value: { errors: { method_payment_type_id: method_payment_type_id cannot be changed } } }
 *               details: { value: { errors: { details.email: email is required } } }
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.put(
  "/:id",
  ...writeAccess(),
  ...validatedBody(updateMethodPaymentSchema, []),
  requireAnyField(
    [...UPDATE_METHOD_PAYMENT_FIELDS, "method_payment_type_id"],
    "At least one field is required",
  ),
  loadMethodPayment,
  async (req, res) => {
    try {
      const method = await methodPaymentService.updateMethodPayment(
        req.methodPayment,
        req.validated,
      );

      return res.status(202).json(toPublicMethodPayment(method));
    } catch (error) {
      return handleMethodPaymentError(error, res);
    }
  },
);

module.exports = router;
