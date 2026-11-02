const { Router } = require("express");
const { validateRequest } = require("../auth/request-validator");
const { orderAccess } = require("./guards");
const { orderService } = require("./service");
const { toPublicOrder } = require("./serializer");
const { handleOrderError } = require("./shared");
const { parsePositiveId } = require("./parsers");
const { STATUS_FIELDS, statusUpdateSchema } = require("./validators");

const router = Router();

/**
 * @openapi
 * /orders/{id}/status:
 *   put:
 *     summary: Applies an order status transition
 *     description: >
 *       The customer can send `draft → request` and cancel their own draft or
 *       requested order. Administrators and sellers can advance the forward
 *       chain, generate directly from `draft`, approve `request → generate`,
 *       invoice `generate → invoiced` and cancel non-terminal orders. Request
 *       freezes prices without reserving stock; generation validates the active
 *       payment term, the cash wallet balance and reserves lots FEFO; invoicing
 *       consumes the reservation and issues the invoice; cancellation releases
 *       reservations without touching physical stock.
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
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [status]
 *             properties:
 *               status:
 *                 type: string
 *                 example: request
 *     responses:
 *       202:
 *         description: Order with the new status and history
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/OrderDetail' }
 *       400:
 *         description: Missing status
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorMessage' }
 *             example: { message: status is required }
 *       401:
 *         description: Missing, invalid or expired token
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorMessage' }
 *       403:
 *         description: Role not allowed for this transition
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorMessage' }
 *       404:
 *         description: Order not found or hidden
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorMessage' }
 *       409:
 *         description: Insufficient stock or wallet balance
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/InsufficientStockError' }
 *       422:
 *         description: Invalid transition, missing/inactive term or empty order
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ValidationErrors' }
 *       503:
 *         description: Incomplete status or currency configuration
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorMessage' }
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.put(
  "/:id/status",
  ...orderAccess(),
  validateRequest({ schema: statusUpdateSchema, fields: [...STATUS_FIELDS] }),
  async (req, res) => {
    const orderId = parsePositiveId(req.params.id);

    if (orderId === null) {
      return res.status(422).json({ errors: { id: "Invalid order id" } });
    }

    try {
      const order = await orderService.updateStatus(
        orderId,
        req.validated,
        req.user,
      );

      return res
        .status(202)
        .json(
          toPublicOrder(order, { includeItems: true, includeHistory: true }),
        );
    } catch (error) {
      return handleOrderError(error, res);
    }
  },
);

module.exports = router;
