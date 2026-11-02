const { Router } = require("express");
const { validateRequest } = require("../auth/request-validator");
const { createAccess } = require("./guards");
const { REQUIRED_ORDER_FIELDS, createOrderSchema } = require("./validators");
const { orderService } = require("./service");
const { toPublicOrder } = require("./serializer");
const { handleOrderError } = require("./shared");
const paymentTermRouter = require("./payment-term");

const router = Router();

/**
 * @openapi
 * /orders:
 *   post:
 *     summary: Creates an order for the authenticated customer
 *     description: >
 *       Requires a JWT with the `customer` role and a linked
 *       `users.customer_id`. The server ignores any `customer_id`, `user_id`,
 *       `status`, `number`, `subtotal`, `total` or `currency_id` sent by the
 *       client. Each line is priced with the customer price list and the
 *       current cost of the chosen item state, converted to the active default
 *       transaction currency and stored as an immutable snapshot. Stock is
 *       reserved per lot in FEFO order with row locks, incrementing
 *       `lots.reserved` and creating one allocation per lot without changing
 *       `lots.stock` or `stocks.quantity`. The whole creation is atomic: if
 *       any line fails, no order, line, allocation, history event or
 *       reservation remains. The response never exposes lots, costs,
 *       warehouses or allocations.
 *     tags:
 *       - Orders
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [items]
 *             properties:
 *               items:
 *                 type: array
 *                 minItems: 1
 *                 maxItems: 50
 *                 items:
 *                   $ref: '#/components/schemas/OrderItemInput'
 *               delivery_address:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 500
 *                 description: Falls back to customers.direction when omitted
 *                 example: Av. Monseñor Rivero 123
 *               notes:
 *                 type: string
 *                 maxLength: 1000
 *                 nullable: true
 *                 example: Entregar por la tarde
 *               payment_term_id:
 *                 type: integer
 *                 minimum: 1
 *                 nullable: true
 *                 description: >
 *                   Optional in draft; a customer copies the term of their
 *                   profile and cannot override it.
 *                 example: 2
 *     responses:
 *       201:
 *         description: Order created with its price snapshot and history
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/OrderDetail' }
 *       400:
 *         description: Missing items
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorMessage' }
 *             example: { message: items is required }
 *       401:
 *         description: Missing, invalid or expired token
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorMessage' }
 *             example: { message: Unauthorized }
 *       403:
 *         description: Role without permission or customer without link/price list
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorMessage' }
 *             example: { message: Customer profile is not linked }
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       409:
 *         description: Insufficient stock; nothing is persisted
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/InsufficientStockError' }
 *             example:
 *               message: Insufficient stock
 *               items:
 *                 - product_id: 15
 *                   item_state_id: 1
 *       422:
 *         description: Invalid lines, duplicated pair, non-sellable state or unavailable product
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ValidationErrors' }
 *             example:
 *               errors:
 *                 items: Product 15 is not available for sale
 *       503:
 *         description: No active default transaction currency
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorMessage' }
 *             example: { message: Default transaction currency is not configured }
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post(
  "/",
  ...createAccess(),
  validateRequest({
    schema: createOrderSchema,
    fields: [...REQUIRED_ORDER_FIELDS],
  }),
  async (req, res) => {
    try {
      const order = await orderService.createOrder(req.validated, req.user);

      return res.status(201).json(
        toPublicOrder(order, {
          includeItems: true,
          includeHistory: true,
        }),
      );
    } catch (error) {
      return handleOrderError(error, res);
    }
  },
);

router.use(paymentTermRouter);

module.exports = router;
