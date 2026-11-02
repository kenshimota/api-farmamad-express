const { Router } = require("express");
const { toPublicPriceList } = require("./serializer");
const {
  REQUIRED_PRICE_LIST_FIELDS,
  updatePriceListSchema,
} = require("./validators");
const {
  handleWriteError,
  loadPriceList,
  validatedBody,
  writeAccess,
} = require("./shared");
const { priceListRepository } = require("./repository");

const router = Router();

/**
 * @openapi
 * /price-lists/{id}:
 *   put:
 *     summary: Replaces a price list; only administrators and sellers
 *     description: >
 *       Full replacement: `name` and `percentage` are required and a missing
 *       description is stored as `null`. A successful update answers 202 with
 *       the updated resource.
 *     tags:
 *       - Price lists
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
 *             required: [name, percentage]
 *             properties:
 *               name:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 150
 *                 example: Mayorista 35
 *               description:
 *                 type: string
 *                 nullable: true
 *                 maxLength: 500
 *                 example: Margen del 35 % para mayoristas
 *               percentage:
 *                 type: number
 *                 minimum: 0
 *                 exclusiveMaximum: 100
 *                 multipleOf: 0.01
 *                 example: 35
 *     responses:
 *       202:
 *         description: Updated public price list data
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
 *         description: The price list does not exist
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *             example:
 *               message: Price list not found
 *       409:
 *         description: Another list already uses the name
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *             example:
 *               message: Price list already exists
 *       422:
 *         description: Invalid price list id or fields
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ValidationErrors'
 *             example:
 *               errors:
 *                 percentage: Invalid percentage
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.put(
  "/:id",
  ...writeAccess(),
  ...validatedBody(updatePriceListSchema, REQUIRED_PRICE_LIST_FIELDS),
  loadPriceList,
  async (req, res) => {
    const values = {
      ...req.validated,
      description: req.validated.description ?? null,
    };

    try {
      const priceList = await priceListRepository.update(req.priceList, values);

      return res.status(202).json(toPublicPriceList(priceList));
    } catch (error) {
      return handleWriteError(error, res);
    }
  },
);

module.exports = router;
