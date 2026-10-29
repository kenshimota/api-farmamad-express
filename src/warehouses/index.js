const { Router } = require("express");
const { toPublicWarehouse } = require("./serializer");
const { createWarehouseSchema } = require("./validators");
const { validatedBody, writeAccess } = require("./guards");
const { warehouseRepository } = require("./repository");
const listRouter = require("./list");
const updateRouter = require("./update");
const removeRouter = require("./remove");

const router = Router();

/**
 * @openapi
 * /warehouses:
 *   post:
 *     summary: Registers a warehouse; only administrators and warehouse managers can do it
 *     tags:
 *       - Warehouses
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
 *               - address
 *             properties:
 *               name:
 *                 type: string
 *                 description: Commercial name; it is not unique
 *                 example: Bodega Central
 *               observations:
 *                 type: string
 *                 nullable: true
 *                 description: Optional free text; omitted or null is stored as NULL
 *                 example: Horario de 8 a 18
 *               address:
 *                 type: string
 *                 example: Av. Monseñor Rivero 123
 *     responses:
 *       201:
 *         description: Warehouse created
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
 *         $ref: '#/components/responses/NotFound'
 *       422:
 *         description: Invalid fields
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ValidationErrors'
 *             example:
 *               errors:
 *                 name: Nombre inválido
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post(
  "/",
  ...writeAccess(),
  ...validatedBody(createWarehouseSchema),
  async (req, res, next) => {
    try {
      const warehouse = await warehouseRepository.create(req.validated);

      return res.status(201).json(toPublicWarehouse(warehouse));
    } catch (error) {
      return next(error);
    }
  },
);

router.use(listRouter);
router.use(updateRouter);
router.use(removeRouter);

module.exports = router;
