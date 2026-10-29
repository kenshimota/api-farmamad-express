const { Router } = require("express");
const { toPublicMethodPayment } = require("./serializer");
const { createMethodPaymentSchema } = require("./validators");
const { validatedBody, writeAccess } = require("./guards");
const { methodPaymentService } = require("./service");
const { handleMethodPaymentError } = require("./errors");
const listRouter = require("./list");
const updateRouter = require("./update");
const removeRouter = require("./remove");

const router = Router();

/**
 * @openapi
 * /method-payments:
 *   post:
 *     summary: Creates a payment method; only administrators can do it
 *     description: >
 *       Requires `method_payment_type_id`, `label` and `details`. The type must
 *       exist, be active and have an active currency. `details` is validated
 *       against the type `fields` inside a transaction: required keys must be
 *       present, unknown keys are rejected, values follow their field type,
 *       text is trimmed and `max_length` is enforced. The currency is inherited
 *       from the type; `currency_id` and `currency` in the body are ignored.
 *       `is_active` defaults to true.
 *     tags:
 *       - Method payments
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [method_payment_type_id, label, details]
 *             properties:
 *               method_payment_type_id: { type: integer, minimum: 1, example: 1 }
 *               label: { type: string, maxLength: 100, example: PayPal Farmamad }
 *               details:
 *                 type: object
 *                 additionalProperties: true
 *                 example: { email: pagos@farmamad.com }
 *               is_active: { type: boolean, default: true, example: true }
 *     responses:
 *       201:
 *         description: Payment method created
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/MethodPayment' }
 *       400:
 *         description: Missing required fields
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorMessage' }
 *             example: { message: method_payment_type_id, label and details are required }
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
 *       409:
 *         description: The label already exists inside the type
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorMessage' }
 *             example: { message: Payment method already exists }
 *       422:
 *         description: Invalid type or details
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ValidationErrors' }
 *             examples:
 *               type: { value: { errors: { method_payment_type_id: Invalid payment type } } }
 *               required: { value: { errors: { details.email: email is required } } }
 *               unknown: { value: { errors: { details.cvv: Unknown field } } }
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post(
  "/",
  ...writeAccess(),
  ...validatedBody(createMethodPaymentSchema),
  async (req, res) => {
    try {
      const method = await methodPaymentService.createMethodPayment(
        req.validated,
      );

      return res.status(201).json(toPublicMethodPayment(method));
    } catch (error) {
      return handleMethodPaymentError(error, res);
    }
  },
);

router.use(listRouter);
router.use(updateRouter);
router.use(removeRouter);

module.exports = router;
