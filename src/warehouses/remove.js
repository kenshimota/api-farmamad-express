const { Router } = require("express");
const { loadWarehouse } = require("./shared");
const { writeAccess } = require("./guards");
const { warehouseRepository } = require("./repository");

const router = Router();

/**
 * @openapi
 * /warehouses/{id}:
 *   delete:
 *     summary: Deletes a warehouse permanently; only administrators and warehouse managers can do it
 *     tags:
 *       - Warehouses
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
 *         description: Warehouse deleted; the response has no body
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
 *         description: The warehouse does not exist
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *             example:
 *               message: Warehouse not found
 *       422:
 *         description: Invalid warehouse id
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ValidationErrors'
 *             example:
 *               errors:
 *                 id: Invalid warehouse id
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.delete(
  "/:id",
  ...writeAccess(),
  loadWarehouse,
  async (req, res, next) => {
    try {
      await warehouseRepository.remove(req.warehouse);

      return res.status(204).send();
    } catch (error) {
      return next(error);
    }
  },
);

module.exports = router;
