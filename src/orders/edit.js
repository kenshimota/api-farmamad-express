const { Router } = require("express");
const { validateRequest } = require("../auth/request-validator");
const { orderAccess } = require("./guards");
const { orderService } = require("./service");
const { toPublicOrder } = require("./serializer");
const { handleOrderError } = require("./shared");
const { parsePositiveId } = require("./parsers");
const { UPDATE_ORDER_FIELDS, updateOrderSchema } = require("./validators");

const router = Router();

/**
 * @openapi
 * /orders/{id}:
 *   put:
 *     summary: Updates the delivery address and notes of a draft order
 *     description: >
 *       The owning customer, an administrator or the assigned seller can edit
 *       the header while the order is in `draft`. Sending `delivery_address`
 *       replaces it (a null value falls back to `customers.direction`);
 *       sending `notes` replaces it (`null` clears it).
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
 *             properties:
 *               delivery_address:
 *                 type: string
 *                 maxLength: 500
 *                 nullable: true
 *               notes: { type: string, maxLength: 1000, nullable: true }
 *     responses:
 *       202:
 *         description: Order with the replaced header
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/OrderDetail' }
 *       401:
 *         description: Missing, invalid or expired token
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorMessage' }
 *       403:
 *         description: Role without permission
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorMessage' }
 *       404:
 *         description: Order not found or hidden
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorMessage' }
 *       422:
 *         description: Order not editable or invalid fields
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ValidationErrors' }
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.put(
  "/:id",
  ...orderAccess(),
  validateRequest({
    schema: updateOrderSchema,
    fields: [...UPDATE_ORDER_FIELDS],
  }),
  async (req, res) => {
    const orderId = parsePositiveId(req.params.id);

    if (orderId === null) {
      return res.status(422).json({ errors: { id: "Invalid order id" } });
    }

    try {
      const order = await orderService.updateOrder(
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
