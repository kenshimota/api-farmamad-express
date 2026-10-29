const { Router } = require("express");
const { loadActiveCurrency } = require("./shared");
const { writeAccess } = require("./guards");
const { currencyService } = require("./service");
const { handleCurrencyError } = require("./errors");

const router = Router();

/**
 * @openapi
 * /currencies/{id}:
 *   delete:
 *     summary: Deactivates a currency; only administrators can do it
 *     description: >
 *       Never deletes the row: it marks `is_active = false` so the rate history
 *       and any future reference are preserved. The base currency cannot be
 *       deactivated and an already inactive currency answers 404. A successful
 *       deactivation responds 204 without body.
 *     tags:
 *       - Currencies
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer, minimum: 1 }
 *         example: 2
 *     responses:
 *       204:
 *         description: Currency deactivated; the response has no body
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
 *         description: The currency does not exist or is already inactive
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorMessage' }
 *             example: { message: Currency not found }
 *       409:
 *         description: The base currency cannot be deactivated
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorMessage' }
 *             example: { message: Base currency cannot be deactivated }
 *       422:
 *         description: Invalid currency id
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ValidationErrors' }
 *             example: { errors: { id: Invalid currency id } }
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.delete(
  "/:id",
  ...writeAccess(),
  loadActiveCurrency,
  async (req, res) => {
    try {
      await currencyService.deactivateCurrency(req.currency);

      return res.status(204).send();
    } catch (error) {
      return handleCurrencyError(error, res);
    }
  },
);

module.exports = router;
