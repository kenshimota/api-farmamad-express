const { Router } = require("express");
const { toPublicItemState } = require("./serializer");
const { loadItemState } = require("./shared");
const { readAccess } = require("./guards");
const { itemStateRepository } = require("./repository");
const { IS_SELLABLE_MESSAGE, parseSellable } = require("./validators");

const router = Router();

/**
 * @openapi
 * /item-states:
 *   get:
 *     summary: Lists item states; any authenticated user can do it
 *     description: >
 *       Returns every item state ordered by name ascending with public fields
 *       only. The optional `is_sellable` filter is exact; it is the base for
 *       querying only sellable inventory in future histories.
 *     tags:
 *       - Item states
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: is_sellable
 *         required: false
 *         schema:
 *           type: boolean
 *         example: true
 *     responses:
 *       200:
 *         description: Item states ordered by name ascending
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/ItemState'
 *       401:
 *         description: Missing, invalid or expired token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *             example:
 *               message: Unauthorized
 *       403:
 *         description: Blocked user
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *             example:
 *               message: User is blocked
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       422:
 *         description: Invalid is_sellable filter
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ValidationErrors'
 *             example:
 *               errors:
 *                 is_sellable: is_sellable must be a boolean
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get("/", ...readAccess(), async (req, res) => {
  const rawIsSellable = req.query.is_sellable;
  let isSellable;

  if (rawIsSellable !== undefined) {
    isSellable = parseSellable(rawIsSellable);

    if (isSellable === undefined) {
      return res.status(422).json({
        errors: { is_sellable: IS_SELLABLE_MESSAGE },
      });
    }
  }

  const itemStates = await itemStateRepository.list({ isSellable });

  return res.json(itemStates.map((itemState) => toPublicItemState(itemState)));
});

/**
 * @openapi
 * /item-states/{id}:
 *   get:
 *     summary: Returns one item state; any authenticated user can do it
 *     tags:
 *       - Item states
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *         example: 1
 *     responses:
 *       200:
 *         description: Public item state data
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ItemState'
 *       401:
 *         description: Missing, invalid or expired token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *             example:
 *               message: Unauthorized
 *       403:
 *         description: Blocked user
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *             example:
 *               message: User is blocked
 *       404:
 *         description: The item state does not exist
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *             example:
 *               message: Item state not found
 *       422:
 *         description: Invalid item state id
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ValidationErrors'
 *             example:
 *               errors:
 *                 id: Invalid item state id
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get("/:id", ...readAccess(), loadItemState, (req, res) =>
  res.json(toPublicItemState(req.item_state)),
);

module.exports = router;
