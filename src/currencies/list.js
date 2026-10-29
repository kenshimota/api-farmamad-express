const { Router } = require("express");
const { toPublicCurrency } = require("./serializer");
const { loadCurrency } = require("./shared");
const { readAccess, isAdmin } = require("./guards");
const { currencyService } = require("./service");
const { parseBooleanFlag } = require("./parsers");
const { INCLUDE_INACTIVE_MESSAGE } = require("./validators");

const router = Router();

/**
 * Resolves the `include_inactive` query flag and the authorization it requires.
 * @param {import("express").Request} req - Express request.
 * @returns {{ includeInactive: boolean }|{ status: number, body: object }}
 *   The listing option or the HTTP error to answer.
 */
function resolveListOptions(req) {
  const raw = req.query.include_inactive;

  if (raw === undefined) {
    return { includeInactive: false };
  }

  const includeInactive = parseBooleanFlag(raw);

  if (includeInactive === undefined) {
    return {
      status: 422,
      body: { errors: { include_inactive: INCLUDE_INACTIVE_MESSAGE } },
    };
  }

  if (includeInactive && !isAdmin(req.user)) {
    return { status: 403, body: { message: "Forbidden" } };
  }

  return { includeInactive };
}

/**
 * @openapi
 * /currencies:
 *   get:
 *     summary: Lists currencies; admin, seller, manager_warehouse and dispatcher
 *     description: >
 *       Returns the active currencies with the base currency first and then by
 *       `code` ascending. With `include_inactive=true` (administrators only)
 *       it also returns the deactivated rows.
 *     tags:
 *       - Currencies
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: include_inactive
 *         required: false
 *         schema: { type: boolean, default: false }
 *         description: Only administrators can request inactive currencies.
 *     responses:
 *       200:
 *         description: Currencies with the base first and then by code
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items: { $ref: '#/components/schemas/Currency' }
 *       401:
 *         description: Missing, invalid or expired token
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorMessage' }
 *       403:
 *         description: Role without permission, blocked user or non-admin asking for inactive rows
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorMessage' }
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       422:
 *         description: Invalid include_inactive flag
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ValidationErrors' }
 *             example: { errors: { include_inactive: Invalid include_inactive } }
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get("/", ...readAccess(), async (req, res) => {
  const options = resolveListOptions(req);

  if (options.status !== undefined) {
    return res.status(options.status).json(options.body);
  }

  const currencies = await currencyService.listCurrencies(options);

  return res.json(currencies.map((currency) => toPublicCurrency(currency)));
});

/**
 * @openapi
 * /currencies/{id}:
 *   get:
 *     summary: Returns one currency; admin, seller, manager_warehouse and dispatcher
 *     description: Inactive currencies can also be read by id.
 *     tags:
 *       - Currencies
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer, minimum: 1 }
 *         example: 1
 *     responses:
 *       200:
 *         description: Public currency data
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Currency' }
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
router.get("/:id", ...readAccess(), loadCurrency, (req, res) =>
  res.json(toPublicCurrency(req.currency)),
);

module.exports = router;
