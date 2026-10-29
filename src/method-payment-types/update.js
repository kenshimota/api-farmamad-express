const { Router } = require("express");
const { toPublicMethodPaymentType } = require("./serializer");
const { loadMethodPaymentType } = require("./shared");
const { requireAnyField, validatedBody, writeAccess } = require("./guards");
const {
  UPDATE_METHOD_PAYMENT_TYPE_FIELDS,
  updateMethodPaymentTypeSchema,
} = require("./validators");
const { methodPaymentTypeService } = require("./service");
const { handleMethodPaymentTypeError } = require("./errors");

const router = Router();

/**
 * @openapi
 * /method-payment-types/{id}:
 *   put:
 *     summary: Updates a payment type; only administrators can do it
 *     description: >
 *       Updates `name`, `description`, `is_active`, and `currency_id`/`fields`
 *       when the type has no concrete payment methods. `code` is immutable and
 *       any value sent for it is ignored. A successful update responds 202.
 *     tags:
 *       - Method payment types
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
 *               name: { type: string, maxLength: 100, example: Banco Nacional (VES) }
 *               currency_id: { type: integer, minimum: 1, example: 1 }
 *               fields:
 *                 type: array
 *                 maxItems: 20
 *                 items: { $ref: '#/components/schemas/MethodPaymentTypeField' }
 *               description:
 *                 type: string
 *                 maxLength: 255
 *                 nullable: true
 *                 example: Cuentas en bolívares
 *               is_active: { type: boolean, example: true }
 *     responses:
 *       202:
 *         description: Updated public payment type data
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/MethodPaymentType' }
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
 *         description: The payment type does not exist
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorMessage' }
 *             example: { message: Payment type not found }
 *       409:
 *         description: Protected field changed on a type that has methods
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorMessage' }
 *             example: { message: Payment type has methods }
 *       422:
 *         description: Invalid id, fields or currency
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ValidationErrors' }
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.put(
  "/:id",
  ...writeAccess(),
  ...validatedBody(updateMethodPaymentTypeSchema, []),
  requireAnyField(
    [...UPDATE_METHOD_PAYMENT_TYPE_FIELDS],
    "At least one field is required",
  ),
  loadMethodPaymentType,
  async (req, res) => {
    try {
      const type = await methodPaymentTypeService.updateMethodPaymentType(
        req.methodPaymentType,
        req.validated,
      );

      return res.status(202).json(toPublicMethodPaymentType(type));
    } catch (error) {
      return handleMethodPaymentTypeError(error, res);
    }
  },
);

module.exports = router;
