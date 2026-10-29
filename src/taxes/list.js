const { Router } = require("express");
const { toPublicTax } = require("./serializer");
const { loadTax } = require("./shared");
const { readAccess } = require("./guards");
const { taxService } = require("./service");
const { parseBooleanFlag } = require("./parsers");
const { IS_ACTIVE_FILTER_MESSAGE } = require("./validators");

const router = Router();

/**
 * Resolves the optional `is_active` query flag.
 * @param {unknown} raw - Raw query value.
 * @returns {{ filters: object }|{ errors: Record<string, string> }} The
 *   service filters or the validation errors.
 */
function resolveListQuery(raw) {
  if (raw === undefined) {
    return { filters: {} };
  }

  const isActive = parseBooleanFlag(raw);

  if (isActive === undefined) {
    return { errors: { is_active: IS_ACTIVE_FILTER_MESSAGE } };
  }

  return { filters: { isActive } };
}

/**
 * @openapi
 * /taxes:
 *   get:
 *     summary: Lists taxes; admin, seller, manager_warehouse and dispatcher
 *     description: >
 *       Returns every tax ordered by `code` ascending, including inactive
 *       rows. The optional exact filter `?is_active=true|false` narrows the
 *       result to active or inactive taxes.
 *     tags:
 *       - Taxes
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: is_active
 *         required: false
 *         schema: { type: boolean }
 *         example: true
 *     responses:
 *       200:
 *         description: Taxes ordered by code
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items: { $ref: '#/components/schemas/Tax' }
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
 *       422:
 *         description: Invalid is_active filter
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ValidationErrors' }
 *             example: { errors: { is_active: Invalid is_active } }
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get("/", ...readAccess(), async (req, res) => {
  const query = resolveListQuery(req.query.is_active);

  if (query.errors) {
    return res.status(422).json({ errors: query.errors });
  }

  const taxes = await taxService.listTaxes(query.filters);

  return res.json(taxes.map((tax) => toPublicTax(tax)));
});

/**
 * @openapi
 * /taxes/{id}:
 *   get:
 *     summary: Returns one tax; admin, seller, manager_warehouse and dispatcher
 *     description: Inactive taxes can also be read by id.
 *     tags:
 *       - Taxes
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
 *         description: Public tax data
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Tax' }
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
 *         description: The tax does not exist
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorMessage' }
 *             example: { message: Tax not found }
 *       422:
 *         description: Invalid tax id
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ValidationErrors' }
 *             example: { errors: { id: Invalid tax id } }
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get("/:id", ...readAccess(), loadTax, (req, res) =>
  res.json(toPublicTax(req.tax)),
);

module.exports = router;
