const { Router } = require("express");
const { toPublicCurrency } = require("./serializer");
const {
  UPDATE_CURRENCY_FIELDS,
  updateCurrencySchema,
} = require("./validators");
const { requireAnyField, validatedBody, writeAccess } = require("./guards");
const { currencyService } = require("./service");
const { handleCurrencyError } = require("./errors");
const { loadCurrency } = require("./shared");

const router = Router();

/**
 * @openapi
 * /currencies/{id}:
 *   put:
 *     summary: Updates a currency; only administrators can do it
 *     description: >
 *       Updates `name`, `symbol`, `rate`, `is_active` and the optional
 *       `reason`. `code` and `is_base` are immutable and ignored. When `rate`
 *       changes, the update and the new `currency_rate_history` row run in one
 *       transaction; changing only name, symbol or status does not append
 *       history. A successful update responds 202.
 *     tags:
 *       - Currencies
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer, minimum: 1 }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string, minLength: 2, maxLength: 100, example: Tether }
 *               symbol: { type: string, minLength: 1, maxLength: 10, example: $ }
 *               rate:
 *                 type: number
 *                 exclusiveMinimum: 0
 *                 maximum: 999999999999
 *                 example: 1005.75
 *               is_active: { type: boolean, example: true }
 *               reason: { type: string, maxLength: 255, example: Actualización diaria BCV }
 *     responses:
 *       202:
 *         description: Updated public currency data
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Currency' }
 *       400:
 *         description: No field was provided
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
 *         description: The currency does not exist
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorMessage' }
 *             example: { message: Currency not found }
 *       409:
 *         description: Protected base currency operation
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorMessage' }
 *             examples:
 *               rate: { value: { message: Base currency rate cannot be changed } }
 *               active: { value: { message: Base currency cannot be deactivated } }
 *       422:
 *         description: Invalid currency id or fields
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ValidationErrors' }
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.put(
  "/:id",
  ...writeAccess(),
  ...validatedBody(updateCurrencySchema, []),
  requireAnyField(
    [...UPDATE_CURRENCY_FIELDS],
    "At least one field is required",
  ),
  loadCurrency,
  async (req, res) => {
    try {
      const currency = await currencyService.updateCurrency(
        req.currency,
        req.validated,
        req.user.sub,
      );

      return res.status(202).json(toPublicCurrency(currency));
    } catch (error) {
      return handleCurrencyError(error, res);
    }
  },
);

module.exports = router;
