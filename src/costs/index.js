const { Router } = require("express");
const { toPublicCost } = require("./serializer");
const { createCostSchema } = require("./validators");
const { validatedBody, writeAccess } = require("./guards");
const { costRepository } = require("./repository");
const { ensureReferences, handleWriteError } = require("./shared");
const listRouter = require("./list");
const updateRouter = require("./update");
const removeRouter = require("./remove");

const router = Router();

/**
 * @openapi
 * /costs:
 *   post:
 *     summary: Creates a cost; only administrators and sellers can do it
 *     description: >
 *       Registers the current cost of a product for a given item state. The
 *       product and the item state must exist, `cost` must be a number between
 *       0 and 999999999.99 with at most two decimals and the combination
 *       `(product_id, item_state_id)` is unique: a duplicate answers 409, use
 *       PUT to update it. The response includes the nested item state without
 *       timestamps.
 *     tags:
 *       - Costs
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - product_id
 *               - item_state_id
 *               - cost
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
 *                 example: 12.5
 *     responses:
 *       201:
 *         description: Cost created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Cost'
 *       400:
 *         description: Missing required fields
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *             example:
 *               message: product_id, item_state_id and cost are required
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
 *         $ref: '#/components/responses/NotFound'
 *       409:
 *         description: The product already has a cost for that item state
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *             example:
 *               message: Cost already exists
 *       422:
 *         description: Invalid fields or non-existent product/item state
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ValidationErrors'
 *             example:
 *               errors:
 *                 product_id: Invalid product
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post(
  "/",
  ...writeAccess(),
  ...validatedBody(createCostSchema),
  ensureReferences,
  async (req, res) => {
    try {
      const cost = await costRepository.create(req.validated);

      return res.status(201).json(toPublicCost(cost));
    } catch (error) {
      return handleWriteError(error, res);
    }
  },
);

router.use(listRouter);
router.use(updateRouter);
router.use(removeRouter);

module.exports = router;
