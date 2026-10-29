const { Router } = require("express");
const { toPublicCurrency } = require("./serializer");
const { createCurrencySchema } = require("./validators");
const { validatedBody, writeAccess } = require("./guards");
const { currencyService } = require("./service");
const { handleCurrencyError } = require("./errors");
const listRouter = require("./list");
const updateRouter = require("./update");
const removeRouter = require("./remove");
const historyRouter = require("./history");

const router = Router();

/**
 * @openapi
 * /currencies:
 *   post:
 *     summary: Creates a currency; only administrators can do it
 *     description: >
 *       Normalizes `code` to uppercase and always creates the currency as
 *       non-base and active; `is_base` and `is_active` sent by the client are
 *       ignored. The first `currency_rate_history` row is inserted inside the
 *       same transaction with `previous_rate = null` and the authenticated
 *       user as `changed_by`.
 *     tags:
 *       - Currencies
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [code, name, symbol, rate]
 *             properties:
 *               code:
 *                 type: string
 *                 pattern: '^[A-Z0-9_]{2,10}$'
 *                 example: EUR
 *               name: { type: string, minLength: 2, maxLength: 100, example: Euro }
 *               symbol: { type: string, minLength: 1, maxLength: 10, example: € }
 *               rate:
 *                 type: number
 *                 exclusiveMinimum: 0
 *                 maximum: 999999999999
 *                 example: 970.5
 *     responses:
 *       201:
 *         description: Currency created
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Currency' }
 *       400:
 *         description: Missing required fields
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorMessage' }
 *             example: { message: code, name, symbol and rate are required }
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
 *             example: { message: Currency already exists }
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
  ...writeAccess(),
  ...validatedBody(createCurrencySchema),
  async (req, res) => {
    try {
      const currency = await currencyService.createCurrency(
        req.validated,
        req.user.sub,
      );

      return res.status(201).json(toPublicCurrency(currency));
    } catch (error) {
      return handleCurrencyError(error, res);
    }
  },
);

router.use(listRouter);
router.use(updateRouter);
router.use(removeRouter);
router.use(historyRouter);

module.exports = router;
