const { Router } = require("express");
const { validateRequest } = require("../auth/request-validator");
const { orderAccess } = require("./guards");
const { orderService } = require("./service");
const { toPublicOrder } = require("./serializer");
const { handleOrderError } = require("./shared");
const { parsePositiveId } = require("./parsers");
const {
  ADD_ITEM_FIELDS,
  UPDATE_ITEM_FIELDS,
  addItemSchema,
  updateItemSchema,
} = require("./validators");

const router = Router();

/**
 * @openapi
 * /orders/{id}/items:
 *   post:
 *     summary: Adds a line to a draft order
 *     description: >
 *       The owning customer, an administrator or the assigned seller can add
 *       lines while the order is in `draft`. The pair
 *       `(product_id, item_state_id)` must be unique and the order accepts at
 *       most 50 lines. The line is priced from the customer price list and the
 *       item state; `products.sale_price` is never used. Stock is not reserved
 *       until the order is generated.
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
 *           schema: { $ref: '#/components/schemas/OrderItemInput' }
 *     responses:
 *       201:
 *         description: Order with the added line and `item_added` event
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/OrderDetail' }
 *       400:
 *         description: Missing product_id, item_state_id or quantity
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorMessage' }
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
 *       409:
 *         description: Duplicated product and item state pair
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorMessage' }
 *       422:
 *         description: Order not editable, invalid item state or no price
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ValidationErrors' }
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post(
  "/:id/items",
  ...orderAccess(),
  validateRequest({ schema: addItemSchema, fields: [...ADD_ITEM_FIELDS] }),
  async (req, res) => {
    const orderId = parsePositiveId(req.params.id);

    if (orderId === null) {
      return res.status(422).json({ errors: { id: "Invalid order id" } });
    }

    try {
      const order = await orderService.addItem(
        orderId,
        req.validated,
        req.user,
      );

      return res
        .status(201)
        .json(
          toPublicOrder(order, { includeItems: true, includeHistory: true }),
        );
    } catch (error) {
      return handleOrderError(error, res);
    }
  },
);

/**
 * @openapi
 * /orders/{id}/items/{item_id}:
 *   put:
 *     summary: Updates the quantity of a draft line
 *     description: >
 *       Only `quantity` can change; `product_id` and `item_state_id` are
 *       immutable. The line is repriced with the current customer list and an
 *       `item_updated` event is appended.
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
 *       - in: path
 *         name: item_id
 *         required: true
 *         schema: { type: integer, minimum: 1 }
 *         example: 20
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [quantity]
 *             properties:
 *               quantity: { type: integer, minimum: 1, maximum: 999, example: 3 }
 *     responses:
 *       202:
 *         description: Order with the updated line
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/OrderDetail' }
 *       400:
 *         description: Missing quantity
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorMessage' }
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
 *         description: Order or line not found or hidden
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorMessage' }
 *       422:
 *         description: Order not editable, invalid quantity or no price
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ValidationErrors' }
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.put(
  "/:id/items/:item_id",
  ...orderAccess(),
  validateRequest({
    schema: updateItemSchema,
    fields: [...UPDATE_ITEM_FIELDS],
  }),
  async (req, res) => {
    const orderId = parsePositiveId(req.params.id);
    const itemId = parsePositiveId(req.params.item_id);

    if (orderId === null) {
      return res.status(422).json({ errors: { id: "Invalid order id" } });
    }

    if (itemId === null) {
      return res.status(422).json({ errors: { item_id: "Invalid item id" } });
    }

    try {
      const order = await orderService.updateItem(
        orderId,
        itemId,
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

/**
 * @openapi
 * /orders/{id}/items/{item_id}:
 *   delete:
 *     summary: Removes a line from a draft order
 *     description: >
 *       The owning customer, an administrator or the assigned seller can
 *       remove a line while the order is in `draft`. An `item_removed` event is
 *       appended and the order totals are recalculated.
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
 *       - in: path
 *         name: item_id
 *         required: true
 *         schema: { type: integer, minimum: 1 }
 *         example: 20
 *     responses:
 *       204:
 *         description: Line removed; no body
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
 *         description: Order or line not found or hidden
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorMessage' }
 *       422:
 *         description: Order not editable or invalid id
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ValidationErrors' }
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.delete("/:id/items/:item_id", ...orderAccess(), async (req, res) => {
  const orderId = parsePositiveId(req.params.id);
  const itemId = parsePositiveId(req.params.item_id);

  if (orderId === null) {
    return res.status(422).json({ errors: { id: "Invalid order id" } });
  }

  if (itemId === null) {
    return res.status(422).json({ errors: { item_id: "Invalid item id" } });
  }

  try {
    await orderService.removeItem(orderId, itemId, req.user);

    return res.status(204).send();
  } catch (error) {
    return handleOrderError(error, res);
  }
});

module.exports = router;
