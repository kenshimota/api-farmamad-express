const { Router } = require("express");
const { loadTax } = require("./shared");
const { writeAccess } = require("./guards");
const { taxService } = require("./service");
const { handleTaxDeleteError } = require("./errors");

const router = Router();

/**
 * @openapi
 * /taxes/{id}:
 *   delete:
 *     summary: Deletes a tax; only administrators can do it
 *     description: >
 *       Permanently deletes the tax and responds 204 without body. When a
 *       future order or any other table still references the tax, the foreign
 *       key RESTRICT blocks the deletion and the API answers 409. To stop
 *       using a tax without deleting it, update it with `is_active = false`.
 *     tags:
 *       - Taxes
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer, minimum: 1 }
 *         example: 1
 *     responses:
 *       204:
 *         description: Tax deleted; the response has no body
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
 *         description: The tax does not exist
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorMessage' }
 *             example: { message: Tax not found }
 *       409:
 *         description: Another table still references the tax
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorMessage' }
 *             example: { message: Tax is in use }
 *       422:
 *         description: Invalid tax id
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ValidationErrors' }
 *             example: { errors: { id: Invalid tax id } }
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.delete("/:id", ...writeAccess(), loadTax, async (req, res) => {
  try {
    await taxService.deleteTax(req.tax);

    return res.status(204).send();
  } catch (error) {
    return handleTaxDeleteError(error, res);
  }
});

module.exports = router;
