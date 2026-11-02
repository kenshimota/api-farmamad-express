const { Router } = require("express");
const { toPublicPriceList } = require("./serializer");
const { loadPriceList, readAccess } = require("./shared");
const { priceListRepository } = require("./repository");

const router = Router();

/**
 * @openapi
 * /price-lists:
 *   get:
 *     summary: Lists every price list; only administrators and sellers
 *     description: >
 *       Returns the price lists ordered by `name` ascending and then by `id`
 *       ascending. Only the public fields are exposed.
 *     tags:
 *       - Price lists
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Price lists ordered by name and id
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/PriceList'
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
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get("/", ...readAccess(), async (req, res) => {
  const priceLists = await priceListRepository.list();

  return res.json(priceLists.map((priceList) => toPublicPriceList(priceList)));
});

/**
 * @openapi
 * /price-lists/{id}:
 *   get:
 *     summary: Returns one price list; only administrators and sellers
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
 *     responses:
 *       200:
 *         description: Public price list data
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PriceList'
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
 *       422:
 *         description: Invalid price list id
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ValidationErrors'
 *             example:
 *               errors:
 *                 id: Invalid price list id
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get("/:id", ...readAccess(), loadPriceList, (req, res) =>
  res.json(toPublicPriceList(req.priceList)),
);

module.exports = router;
