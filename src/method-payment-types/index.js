const { Router } = require("express");
const { toPublicMethodPaymentType } = require("./serializer");
const { createMethodPaymentTypeSchema } = require("./validators");
const { validatedBody, writeAccess } = require("./guards");
const { methodPaymentTypeService } = require("./service");
const { handleMethodPaymentTypeError } = require("./errors");
const listRouter = require("./list");
const updateRouter = require("./update");
const removeRouter = require("./remove");

const router = Router();

/**
 * @openapi
 * /method-payment-types:
 *   post:
 *     summary: Creates a payment type; only administrators can do it
 *     description: >
 *       Requires `code`, `name` and `currency_id`. The code is trimmed,
 *       uppercased, matches `^[A-Z0-9_]{2,30}$` and is unique ignoring case.
 *       The currency must exist and be active. `fields` defaults to `[]` and
 *       follows RF-05: at most 20 definitions with unique keys, allowed types
 *       (`text`, `email`, `phone`, `integer`, `boolean`) and `max_length` only
 *       on text-like types. `is_active` defaults to true.
 *     tags:
 *       - Method payment types
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [code, name, currency_id]
 *             properties:
 *               code:
 *                 type: string
 *                 pattern: '^[A-Z0-9_]{2,30}$'
 *                 example: PAYPAL
 *               name: { type: string, maxLength: 100, example: PayPal }
 *               currency_id: { type: integer, minimum: 1, example: 3 }
 *               fields:
 *                 type: array
 *                 maxItems: 20
 *                 items: { $ref: '#/components/schemas/MethodPaymentTypeField' }
 *               description:
 *                 type: string
 *                 maxLength: 255
 *                 nullable: true
 *                 example: Pagos por PayPal
 *               is_active: { type: boolean, default: true, example: true }
 *     responses:
 *       201:
 *         description: Payment type created
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/MethodPaymentType' }
 *       400:
 *         description: Missing required fields
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorMessage' }
 *             example: { message: code, name and currency_id are required }
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
 *         description: The code already exists (ignoring case)
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorMessage' }
 *             example: { message: Payment type already exists }
 *       422:
 *         description: Invalid fields or currency
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ValidationErrors' }
 *             examples:
 *               currency: { value: { errors: { currency_id: Invalid currency } } }
 *               fields: { value: { errors: { fields: Invalid fields definition } } }
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post(
  "/",
  ...writeAccess(),
  ...validatedBody(createMethodPaymentTypeSchema),
  async (req, res) => {
    try {
      const type = await methodPaymentTypeService.createMethodPaymentType(
        req.validated,
      );

      return res.status(201).json(toPublicMethodPaymentType(type));
    } catch (error) {
      return handleMethodPaymentTypeError(error, res);
    }
  },
);

router.use(listRouter);
router.use(updateRouter);
router.use(removeRouter);

module.exports = router;
