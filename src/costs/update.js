const { Router } = require("express");
const { toPublicCost } = require("./serializer");
const { updateCostSchema } = require("./validators");
const {
  ensureReferences,
  handleWriteError,
  loadCost,
  resolveUpdateCurrency,
} = require("./shared");
const { requireAnyField, validatedBody, writeAccess } = require("./guards");
const { costRepository } = require("./repository");

const router = Router();

const UPDATE_FIELDS = Object.freeze([
  "product_id",
  "item_state_id",
  "cost",
  "currency_id",
]);

/**
 * @openapi
 * /costs/{id}:
 *   put:
 *     summary: Updates a cost; only administrators and sellers can do it
 *     description: >
 *       Accepts any combination of `cost`, `product_id`, `item_state_id` and
 *       `currency_id` (at least one) and responds 202 with the updated
 *       resource. Changing the currency never converts the amount: the same
 *       number is interpreted in the new currency. New references must exist
 *       and the resulting combination must stay unique; changing it to an
 *       existing one answers 409. The updated response includes the nested item
 *       state and currency without timestamps.
 *     tags:
 *       - Costs
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
 *               product_id:
 *                 type: integer
 *                 minimum: 1
 *                 example: 15
 *               item_state_id:
 *                 type: integer
 *                 minimum: 1
 *                 example: 2
 *               cost:
 *                 type: number
 *                 format: double
 *                 minimum: 0
 *                 maximum: 999999999.99
 *                 multipleOf: 0.01
 *                 example: 20
 *               currency_id:
 *                 type: integer
 *                 minimum: 1
 *                 example: 3
 *     responses:
 *       202:
 *         description: Updated public cost data
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Cost'
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
 *         description: The cost does not exist
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *             example:
 *               message: Cost not found
 *       409:
 *         description: Another cost already uses the new combination
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *             example:
 *               message: Cost already exists
 *       422:
 *         description: Invalid cost id, fields or references
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ValidationErrors'
 *             example:
 *               errors:
 *                 cost: cost must be >= 0
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.put(
  "/:id",
  ...writeAccess(),
  ...validatedBody(updateCostSchema, []),
  requireAnyField([...UPDATE_FIELDS], "at least one field is required"),
  loadCost,
  ensureReferences,
  resolveUpdateCurrency,
  async (req, res) => {
    try {
      const cost = await costRepository.update(req.cost, req.validated);

      return res.status(202).json(toPublicCost(cost));
    } catch (error) {
      return handleWriteError(error, res);
    }
  },
);

module.exports = router;
