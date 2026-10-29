const { Router } = require("express");
const { toPublicWarehouse } = require("./serializer");
const { updateWarehouseSchema } = require("./validators");
const { loadWarehouse } = require("./shared");
const { validatedBody, writeAccess } = require("./guards");
const { warehouseRepository } = require("./repository");

const router = Router();

/**
 * @openapi
 * /warehouses/{id}:
 *   put:
 *     summary: Updates a warehouse; only administrators and warehouse managers can do it
 *     description: >
 *       Replaces `name` and `address`, which are required. `observations` is
 *       updated only when the client sends it; when omitted the stored value is
 *       kept, and an explicit null clears it. As with every PUT endpoint, a
 *       successful update responds 202 Accepted with the updated resource in
 *       the body.
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
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - address
 *             properties:
 *               name:
 *                 type: string
 *                 example: Bodega Sur
 *               observations:
 *                 type: string
 *                 nullable: true
 *                 description: Optional; when omitted the stored value is kept
 *                 example: Horario de 9 a 17
 *               address:
 *                 type: string
 *                 example: Calle 3 #10
 *     responses:
 *       202:
 *         description: Updated public warehouse data
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Warehouse'
 *       400:
 *         description: Missing required fields
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *             example:
 *               message: name and address are required
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
 *         description: Invalid warehouse id or fields
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
router.put(
  "/:id",
  ...writeAccess(),
  ...validatedBody(updateWarehouseSchema),
  loadWarehouse,
  async (req, res, next) => {
    try {
      await warehouseRepository.update(req.warehouse, req.validated);

      return res.status(202).json(toPublicWarehouse(req.warehouse));
    } catch (error) {
      return next(error);
    }
  },
);

module.exports = router;
