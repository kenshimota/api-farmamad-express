const { Router } = require("express");
const { handleDeleteError, loadPriceList, writeAccess } = require("./shared");
const { priceListRepository } = require("./repository");

const router = Router();

/**
 * @openapi
 * /price-lists/{id}:
 *   delete:
 *     summary: Deletes a price list permanently; only administrators and sellers
 *     description: >
 *       A list assigned to at least one customer cannot be deleted: it answers
 *       409 `Price list is in use`. An unused list answers 204 without body.
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
 *       204:
 *         description: Price list deleted; the response has no body
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
 *         description: The price list is assigned to a customer
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *             example:
 *               message: Price list is in use
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
router.delete("/:id", ...writeAccess(), loadPriceList, async (req, res) => {
  const assignedCustomers = await priceListRepository.countCustomers(
    req.priceList.id,
  );

  if (assignedCustomers > 0) {
    return res.status(409).json({ message: "Price list is in use" });
  }

  try {
    await priceListRepository.remove(req.priceList);

    return res.status(204).send();
  } catch (error) {
    return handleDeleteError(error, res);
  }
});

module.exports = router;
