const { Router } = require("express");
const { pickingAccess } = require("./picking-guards");
const { toPickingResponse } = require("./picking-serializer");
const { parsePositiveId } = require("./parsers");
const { handleOrderError } = require("./shared");
const { orderNotFound } = require("./errors");
const { invalidAllocationStatus } = require("./picking-errors");
const { parseAllocationStatus } = require("./picking-allocation-statuses");

const router = Router();

/**
 * @openapi
 * /orders/{id}/picking:
 *   get:
 *     summary: Returns the picking list of an order with lots and locations
 *     description: >
 *       Read-only preparation view for `admin`, `seller`,
 *       `manager_warehouse` and `dispatcher`. It returns the order header, the
 *       customer delivery data, a preparation summary and one line per order
 *       item. Each line carries its product, item state and the allocations per
 *       lot ordered FEFO (expiration date and lot id ascending). The
 *       `quantity` of each allocation is the amount to pack; the lot
 *       `available` is only the remaining inventory reference. By default the
 *       `reserved` and `consumed` allocations are returned, so the view works
 *       before invoicing (`generate`) and after it (`invoiced`). Customers and
 *       support always receive `403` because the physical location is internal.
 *       This endpoint does not replace `GET /orders/{id}` or
 *       `GET /orders/{id}/invoice` and never writes any row.
 *     tags:
 *       - Orders
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer, minimum: 1 }
 *         example: 10
 *       - in: query
 *         name: allocation_status
 *         required: false
 *         schema:
 *           type: string
 *           enum: [reserved, consumed, released, all]
 *         description: >
 *           Filters the returned allocations. Without it, `reserved` and
 *           `consumed` are included. `all` returns the three statuses.
 *     responses:
 *       200:
 *         description: Order, customer, preparation summary and items with lots
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/OrderPicking' }
 *       401:
 *         description: Missing, invalid or expired token
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorMessage' }
 *             example: { message: Unauthorized }
 *       403:
 *         description: Role without permission or blocked user
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorMessage' }
 *             example: { message: Forbidden }
 *       404:
 *         description: Order not found
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorMessage' }
 *             example: { message: Order not found }
 *       422:
 *         description: Invalid order id or allocation_status
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ValidationErrors' }
 *             examples:
 *               invalidId:
 *                 value: { errors: { id: Invalid order id } }
 *               invalidAllocationStatus:
 *                 value: { errors: { allocation_status: Invalid allocation_status } }
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get("/:id/picking", ...pickingAccess(), async (req, res) => {
  const id = parsePositiveId(req.params.id);

  if (id === null) {
    return res.status(422).json({ errors: { id: "Invalid order id" } });
  }

  const allocationStatus = parseAllocationStatus(req.query.allocation_status);

  if (allocationStatus === null) {
    return handleOrderError(invalidAllocationStatus(), res);
  }

  try {
    // Required on demand so loading the orders router does not instantiate
    // every Sequelize model for tests that replace the persistence layer.
    const { pickingRepository } = require("./picking-repository");
    const order = await pickingRepository.findOrderById(id, {
      allocationStatus,
    });

    if (!order) {
      throw orderNotFound();
    }

    return res.json(toPickingResponse(order));
  } catch (error) {
    return handleOrderError(error, res);
  }
});

module.exports = router;
module.exports.parseAllocationStatus = parseAllocationStatus;
