const { Router } = require("express");
const { toPublicTax } = require("./serializer");
const { createTaxSchema } = require("./validators");
const { validatedBody, writeAccess } = require("./guards");
const { taxService } = require("./service");
const { handleTaxError } = require("./errors");
const listRouter = require("./list");
const updateRouter = require("./update");
const removeRouter = require("./remove");

const router = Router();

/**
 * @openapi
 * /taxes:
 *   post:
 *     summary: Creates a tax; only administrators can do it
 *     description: >
 *       Requires `code`, `name` and `rate`. The code is trimmed, uppercased
 *       and must match `^[A-Za-z0-9_]{2,20}$`; it is unique ignoring case.
 *       `rate` is a percentage between 0 and 100 with at most two decimals,
 *       stored as DECIMAL(5,2). `description` is optional and `is_active`
 *       defaults to true.
 *     tags:
 *       - Taxes
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [code, name, rate]
 *             properties:
 *               code:
 *                 type: string
 *                 pattern: '^[A-Za-z0-9_]{2,20}$'
 *                 example: IVA
 *               name:
 *                 type: string
 *                 minLength: 2
 *                 maxLength: 100
 *                 example: Impuesto al Valor Agregado
 *               rate:
 *                 type: number
 *                 minimum: 0
 *                 maximum: 100
 *                 multipleOf: 0.01
 *                 example: 16
 *               description:
 *                 type: string
 *                 maxLength: 255
 *                 nullable: true
 *                 example: IVA general
 *               is_active: { type: boolean, default: true, example: true }
 *     responses:
 *       201:
 *         description: Tax created
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Tax' }
 *       400:
 *         description: Missing required fields
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorMessage' }
 *             example: { message: code, name and rate are required }
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
 *             example: { message: Tax already exists }
 *       422:
 *         description: Invalid fields
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ValidationErrors' }
 *             example: { errors: { rate: rate must be between 0 and 100 } }
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post(
  "/",
  ...writeAccess(),
  ...validatedBody(createTaxSchema),
  async (req, res) => {
    try {
      const tax = await taxService.createTax(req.validated);

      return res.status(201).json(toPublicTax(tax));
    } catch (error) {
      return handleTaxError(error, res);
    }
  },
);

router.use(listRouter);
router.use(updateRouter);
router.use(removeRouter);

module.exports = router;
