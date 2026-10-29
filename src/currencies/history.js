const { Router } = require("express");
const { toPublicHistoryEntry } = require("./serializer");
const { loadCurrency } = require("./shared");
const { readAccess } = require("./guards");
const { currencyService } = require("./service");

const router = Router();

/**
 * @openapi
 * /currencies/{id}/history:
 *   get:
 *     summary: Returns the rate history; admin, seller, manager_warehouse and dispatcher
 *     description: >
 *       Returns every append-only rate change of the currency ordered by
 *       `changed_at` descending. Each row includes the nested `changed_by`
 *       user (`id`, `username`, `email`) or `null` when it came from the
 *       seeder or the user was deleted. The history cannot be edited or
 *       deleted through the API.
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
 *       200:
 *         description: History rows ordered by changed_at descending
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items: { $ref: '#/components/schemas/CurrencyRateHistory' }
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
 *       422:
 *         description: Invalid currency id
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ValidationErrors' }
 *             example: { errors: { id: Invalid currency id } }
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get("/:id/history", ...readAccess(), loadCurrency, async (req, res) => {
  const history = await currencyService.getRateHistory(req.currency.id);

  return res.json(history.map((entry) => toPublicHistoryEntry(entry)));
});

module.exports = router;
