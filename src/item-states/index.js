const { Router } = require("express");
const { toPublicItemState } = require("./serializer");
const { createItemStateSchema } = require("./validators");
const { validatedBody, writeAccess } = require("./guards");
const { itemStateRepository } = require("./repository");
const { handleWriteError } = require("./shared");
const listRouter = require("./list");
const updateRouter = require("./update");
const removeRouter = require("./remove");

const router = Router();

/**
 * @openapi
 * /item-states:
 *   post:
 *     summary: Creates an item state; only administrators and sellers can do it
 *     description: >
 *       `name` is the stable snake_case key (2–50 characters, only lowercase
 *       letters, digits and underscores) and is unique ignoring case. `label`
 *       is the visible text (2–100 characters). `description` admits up to 255
 *       characters and `is_sellable` defaults to false.
 *     tags:
 *       - Item states
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - label
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
 *                 default: false
 *                 example: false
 *     responses:
 *       201:
 *         description: Item state created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ItemState'
 *       400:
 *         description: Missing required fields
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *             example:
 *               message: name and label are required
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
 *         description: The item state name already exists
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *             example:
 *               message: Item state already exists
 *       422:
 *         description: Invalid fields
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
router.post(
  "/",
  ...writeAccess(),
  ...validatedBody(createItemStateSchema),
  async (req, res) => {
    try {
      const itemState = await itemStateRepository.create(req.validated);

      return res.status(201).json(toPublicItemState(itemState));
    } catch (error) {
      return handleWriteError(error, res);
    }
  },
);

router.use(listRouter);
router.use(updateRouter);
router.use(removeRouter);

module.exports = router;
