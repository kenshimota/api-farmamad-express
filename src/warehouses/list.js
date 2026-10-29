const { Router } = require("express");
const { toPublicWarehouse } = require("./serializer");
const { loadWarehouse } = require("./shared");
const { readAccess } = require("./guards");
const { warehouseRepository } = require("./repository");

const router = Router();

/**
 * @openapi
 * /warehouses:
 *   get:
 *     summary: Lists warehouses; administrators, dispatchers and warehouse managers can do it
 *     description: >
 *       Returns every warehouse ordered by id ascending with public fields
 *       only. The optional `search` query filters partially and
 *       case-insensitively against name, observations and address; a warehouse
 *       that matches several fields appears only once.
 *     tags:
 *       - Warehouses
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: search
 *         required: false
 *         schema:
 *           type: string
 *         description: Partial term; blank or omitted returns the full list
 *         example: central
 *     responses:
 *       200:
 *         description: Warehouses ordered by id ascending with public fields only
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Warehouse'
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
  const warehouses = await warehouseRepository.list(req.query.search);

  return res.json(warehouses.map((warehouse) => toPublicWarehouse(warehouse)));
});

/**
 * @openapi
 * /warehouses/{id}:
 *   get:
 *     summary: Returns one warehouse; administrators, dispatchers and warehouse managers can do it
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
 *       200:
 *         description: Public warehouse data
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Warehouse'
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
router.get("/:id", ...readAccess(), loadWarehouse, (req, res) =>
  res.json(toPublicWarehouse(req.warehouse)),
);

module.exports = router;
