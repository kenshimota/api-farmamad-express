const { Router } = require("express");
const { toPublicMethodPaymentType } = require("./serializer");
const { loadMethodPaymentType } = require("./shared");
const { readAccess } = require("./guards");
const { methodPaymentTypeService } = require("./service");
const { parseBooleanFlag, parsePositiveInteger } = require("./parsers");
const {
  CURRENCY_FILTER_MESSAGE,
  IS_ACTIVE_FILTER_MESSAGE,
} = require("./validators");

const router = Router();

/**
 * Resolves the optional `currency_id` and `is_active` query filters.
 * @param {object} query - Express query object.
 * @returns {{ filters: object }|{ errors: Record<string, string> }} The
 *   service filters or the validation errors.
 */
function resolveListQuery({
  currency_id: rawCurrencyId,
  is_active: rawIsActive,
}) {
  const filters = {};
  const errors = {};

  if (rawIsActive !== undefined) {
    const isActive = parseBooleanFlag(rawIsActive);

    if (isActive === undefined) {
      errors.is_active = IS_ACTIVE_FILTER_MESSAGE;
    } else {
      filters.isActive = isActive;
    }
  }

  if (rawCurrencyId !== undefined) {
    const currencyId = parsePositiveInteger(rawCurrencyId);

    if (currencyId === null) {
      errors.currency_id = CURRENCY_FILTER_MESSAGE;
    } else {
      filters.currencyId = currencyId;
    }
  }

  if (Object.keys(errors).length > 0) {
    return { errors };
  }

  return { filters };
}

/**
 * @openapi
 * /method-payment-types:
 *   get:
 *     summary: Lists payment types; admin, seller and dispatcher
 *     description: >
 *       Returns every payment type ordered by `code` ascending, including
 *       inactive rows, each one with its nested currency. The optional exact
 *       filters `?currency_id=` and `?is_active=true|false` narrow the result.
 *     tags:
 *       - Method payment types
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: currency_id
 *         required: false
 *         schema: { type: integer, minimum: 1 }
 *         example: 1
 *       - in: query
 *         name: is_active
 *         required: false
 *         schema: { type: boolean }
 *         example: true
 *     responses:
 *       200:
 *         description: Payment types ordered by code
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items: { $ref: '#/components/schemas/MethodPaymentType' }
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
 *         description: Invalid filter
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ValidationErrors' }
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get("/", ...readAccess(), async (req, res) => {
  const query = resolveListQuery(req.query);

  if (query.errors) {
    return res.status(422).json({ errors: query.errors });
  }

  const types = await methodPaymentTypeService.listMethodPaymentTypes(
    query.filters,
  );

  return res.json(types.map((type) => toPublicMethodPaymentType(type)));
});

/**
 * @openapi
 * /method-payment-types/{id}:
 *   get:
 *     summary: Returns one payment type; admin, seller and dispatcher
 *     description: Inactive types can also be read by id.
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
 *     responses:
 *       200:
 *         description: Public payment type data
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/MethodPaymentType' }
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
 *       422:
 *         description: Invalid payment type id
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ValidationErrors' }
 *             example: { errors: { id: Invalid payment type id } }
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get("/:id", ...readAccess(), loadMethodPaymentType, (req, res) =>
  res.json(toPublicMethodPaymentType(req.methodPaymentType)),
);

module.exports = router;
