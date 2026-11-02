const { Router } = require("express");
const { toPublicPriceList } = require("./serializer");
const {
  createPriceListSchema,
  REQUIRED_PRICE_LIST_FIELDS,
} = require("./validators");
const { handleWriteError, validatedBody, writeAccess } = require("./shared");
const { priceListRepository } = require("./repository");
const listRouter = require("./list");
const updateRouter = require("./update");
const removeRouter = require("./remove");

const router = Router();

/**
 * @openapi
 * /price-lists:
 *   post:
 *     summary: Creates a price list; only administrators and sellers
 *     description: >
 *       A price list stores a margin percentage over the real cost. `name` is
 *       unique ignoring case and `percentage` must be a number in the
 *       `[0, 100)` range with at most two decimals. The description is
 *       optional, is trimmed and is stored as `null` when blank.
 *     tags:
 *       - Price lists
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, percentage]
 *             properties:
 *               name:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 150
 *                 example: Mayorista 30
 *               description:
 *                 type: string
 *                 nullable: true
 *                 maxLength: 500
 *                 example: Margen del 30 % para mayoristas
 *               percentage:
 *                 type: number
 *                 minimum: 0
 *                 exclusiveMaximum: 100
 *                 multipleOf: 0.01
 *                 example: 30
 *     responses:
 *       201:
 *         description: Price list created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PriceList'
 *       400:
 *         description: Missing required fields
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *             example:
 *               message: name and percentage are required
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
 *         description: Another list already uses the name
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *             example:
 *               message: Price list already exists
 *       422:
 *         description: Invalid name, description or percentage
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ValidationErrors'
 *             example:
 *               errors:
 *                 percentage: percentage must be < 100
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post(
  "/",
  ...writeAccess(),
  ...validatedBody(createPriceListSchema, REQUIRED_PRICE_LIST_FIELDS),
  async (req, res) => {
    try {
      const priceList = await priceListRepository.create(req.validated);

      return res.status(201).json(toPublicPriceList(priceList));
    } catch (error) {
      return handleWriteError(error, res);
    }
  },
);

router.use(listRouter);
router.use(updateRouter);
router.use(removeRouter);

module.exports = router;
