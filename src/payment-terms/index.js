const { Router } = require("express");
const { toPublicPaymentTerm } = require("./serializer");
const { createPaymentTermSchema } = require("./validators");
const { access, validatedBody } = require("./guards");
const { paymentTermService } = require("./service");
const { handlePaymentTermError } = require("./errors");
const listRouter = require("./list");
const updateRouter = require("./update");
const removeRouter = require("./remove");

const router = Router();

/**
 * @openapi
 * /payment-terms:
 *   post:
 *     summary: Creates a payment term; only administrators and sellers can do it
 *     description: >
 *       Requires `code`, `name` and `days`. The code is trimmed, lowercased
 *       and must match `^[a-z][a-z0-9_]{1,29}$`; it is unique ignoring case and
 *       immutable after creation. `days = 0` means cash and `days > 0` means
 *       credit. `description` is optional and `is_active` defaults to true.
 *     tags:
 *       - Payment terms
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [code, name, days]
 *             properties:
 *               code:
 *                 type: string
 *                 pattern: '^[a-z][a-z0-9_]{1,29}$'
 *                 example: credit_30
 *               name:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 100
 *                 example: Crédito 30 días
 *               description:
 *                 type: string
 *                 maxLength: 255
 *                 nullable: true
 *                 example: Pago a 30 días
 *               days:
 *                 type: integer
 *                 minimum: 0
 *                 maximum: 3650
 *                 example: 30
 *               is_active:
 *                 type: boolean
 *                 default: true
 *                 example: true
 *     responses:
 *       201:
 *         description: Payment term created
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/PaymentTerm' }
 *       400:
 *         description: Missing required fields
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorMessage' }
 *             example: { message: code, name and days are required }
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
 *             example: { message: Payment term already exists }
 *       422:
 *         description: Invalid fields
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ValidationErrors' }
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post(
  "/",
  ...access(),
  ...validatedBody(createPaymentTermSchema),
  async (req, res) => {
    try {
      const term = await paymentTermService.createPaymentTerm(req.validated);

      return res.status(201).json(toPublicPaymentTerm(term));
    } catch (error) {
      return handlePaymentTermError(error, res);
    }
  },
);

router.use(listRouter);
router.use(updateRouter);
router.use(removeRouter);

module.exports = router;
