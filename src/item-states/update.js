const { Router } = require("express");
const { toPublicItemState } = require("./serializer");
const { updateItemStateSchema } = require("./validators");
const { loadItemState, handleWriteError } = require("./shared");
const { requireAnyField, validatedBody, writeAccess } = require("./guards");
const { itemStateRepository } = require("./repository");

const router = Router();

const UPDATE_FIELDS = Object.freeze([
  "name",
  "label",
  "description",
  "is_sellable",
]);

/**
 * @openapi
 * /item-states/{id}:
 *   put:
 *     summary: Updates an item state; only administrators and sellers can do it
 *     description: >
 *       Accepts any combination of `name`, `label`, `description` and
 *       `is_sellable` (at least one) and responds 202 with the updated
 *       resource. `name` is the stable key: it can only change when the item
 *       state is not referenced by costs, stocks or purchase items; otherwise
 *       the API answers 409 `Item state is in use`. Costs, stocks and purchase
 *       items are checked before renaming.
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
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 minLength: 2
 *                 maxLength: 50
 *                 pattern: '^[a-z0-9_]+$'
 *                 example: returned
 *               label:
 *                 type: string
 *                 minLength: 2
 *                 maxLength: 100
 *                 example: Devuelto
 *               description:
 *                 type: string
 *                 maxLength: 255
 *                 nullable: true
 *                 example: Devuelto por el cliente
 *               is_sellable:
 *                 type: boolean
 *                 example: false
 *     responses:
 *       202:
 *         description: Updated public item state data
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ItemState'
 *       400:
 *         description: No field was provided
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *             example:
 *               message: at least one field is required
 *       401:
 *         description: Missing, invalid or expired token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *             example:
 *               message: Unauthorized
 *       403:
 *         description: Role without permission or blocked user
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *             example:
 *               message: Forbidden
 *       404:
 *         description: The item state does not exist
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *             example:
 *               message: Item state not found
 *       409:
 *         description: The name belongs to another item state or is in use
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *             examples:
 *               duplicate:
 *                 value:
 *                   message: Item state already exists
 *               inUse:
 *                 value:
 *                   message: Item state is in use
 *       422:
 *         description: Invalid item state id or fields
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ValidationErrors'
 *             example:
 *               errors:
 *                 name: name must be snake_case
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.put(
  "/:id",
  ...writeAccess(),
  ...validatedBody(updateItemStateSchema, []),
  requireAnyField([...UPDATE_FIELDS], "at least one field is required"),
  loadItemState,
  async (req, res) => {
    try {
      const changesName =
        req.validated.name !== undefined &&
        req.validated.name !== req.item_state.name;

      if (
        changesName &&
        (await itemStateRepository.isReferenced(req.item_state.id))
      ) {
        return res.status(409).json({ message: "Item state is in use" });
      }

      await itemStateRepository.update(req.item_state, req.validated);

      return res.status(202).json(toPublicItemState(req.item_state));
    } catch (error) {
      return handleWriteError(error, res);
    }
  },
);

module.exports = router;
