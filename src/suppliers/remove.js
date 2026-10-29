const { Router } = require("express");
const { handleDeleteError, loadSupplier } = require("./shared");
const { writeAccess } = require("./guards");
const { supplierRepository } = require("./repository");

const router = Router();

/**
 * @openapi
 * /suppliers/{id}:
 *   delete:
 *     summary: Deletes a supplier permanently; only administrators and sellers can do it
 *     description: >
 *       A supplier with purchases cannot be removed: it responds 409 with
 *       `Supplier is in use`. The purchases table arrives with HU-21; the
 *       repository already exposes the check and the restrictive foreign key
 *       is mapped to the same 409.
 *     tags:
 *       - Suppliers
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
 *         description: Supplier deleted; the response has no body
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
 *         description: The supplier does not exist
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *             example:
 *               message: Supplier not found
 *       409:
 *         description: A purchase references the supplier
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *             example:
 *               message: Supplier is in use
 *       422:
 *         description: Invalid supplier id
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ValidationErrors'
 *             example:
 *               errors:
 *                 id: Invalid supplier id
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.delete("/:id", ...writeAccess(), loadSupplier, async (req, res) => {
  try {
    if (await supplierRepository.hasPurchases(req.supplier.id)) {
      return res.status(409).json({ message: "Supplier is in use" });
    }

    await supplierRepository.remove(req.supplier);

    return res.status(204).send();
  } catch (error) {
    return handleDeleteError(error, res);
  }
});

module.exports = router;
