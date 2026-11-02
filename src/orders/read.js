const { Router } = require("express");
const { orderAccess } = require("./guards");
const { orderService } = require("./service");
const { toPublicOrder } = require("./serializer");
const { handleOrderError } = require("./shared");
const { parsePositiveId } = require("./parsers");
const { toPublicInvoice } = require("../invoices/serializer");
const { INTERNAL_ROLES } = require("./constants");

const router = Router();

/**
 * @openapi
 * /orders:
 *   get:
 *     summary: Lists the orders visible to the authenticated user
 *     description: >
 *       Customers only see their own orders; administrators and sellers see
 *       every order. Each row is the order summary plus `items_count`.
 *     tags:
 *       - Orders
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Orders ordered newest first
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items: { $ref: '#/components/schemas/OrderSummary' }
 *       401:
 *         description: Missing, invalid or expired token
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorMessage' }
 *       403:
 *         description: Role without permission or unlinked customer
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorMessage' }
 *       404:
 *         description: No order matches the requested scope
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorMessage' }
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get("/", ...orderAccess(), async (req, res) => {
  try {
    const orders = await orderService.listOrders(req.user);

    return res.json(
      orders.map((order) => toPublicOrder(order, { includeItemsCount: true })),
    );
  } catch (error) {
    return handleOrderError(error, res);
  }
});

/**
 * @openapi
 * /orders/{id}/invoice:
 *   get:
 *     summary: Returns the invoice issued for an order
 *     description: >
 *       Customers can only read their own order invoice; administrators and
 *       sellers can read any. The order visibility rule is applied first, then
 *       the invoice serializer hides `invoiced_by` from customers.
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
 *     responses:
 *       200:
 *         description: Invoice detail
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/InvoiceDetail' }
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
 *         description: Order or invoice not found
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorMessage' }
 *       422:
 *         description: Invalid order id
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ValidationErrors' }
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get("/:id/invoice", ...orderAccess(), async (req, res) => {
  const id = parsePositiveId(req.params.id);

  if (id === null) {
    return res.status(422).json({ errors: { id: "Invalid order id" } });
  }

  try {
    const invoice = await orderService.getInvoiceByOrder(id, req.user);

    return res.json(
      toPublicInvoice(invoice, {
        includeItems: true,
        includeInvoicedBy: INTERNAL_ROLES.includes(req.user.role),
        includePaymentHistory: true,
      }),
    );
  } catch (error) {
    return handleOrderError(error, res);
  }
});

/**
 * @openapi
 * /orders/{id}:
 *   get:
 *     summary: Returns one order with its lines and history
 *     description: >
 *       Customers only see their own orders and never receive the history
 *       actor. Administrators and sellers see any order and receive
 *       `actor: { id, username, email }` (or null) in each history event. Lot
 *       allocations, costs, warehouses and other customers are never exposed.
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
 *     responses:
 *       200:
 *         description: Order detail
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
 *         description: Order not found or hidden from the customer
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorMessage' }
 *             example: { message: Order not found }
 *       422:
 *         description: Invalid order id
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ValidationErrors' }
 *             example: { errors: { id: Invalid order id } }
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get("/:id", ...orderAccess(), async (req, res) => {
  const id = parsePositiveId(req.params.id);

  if (id === null) {
    return res.status(422).json({ errors: { id: "Invalid order id" } });
  }

  try {
    const { order, context } = await orderService.getOrder(id, req.user);

    return res.json(
      toPublicOrder(order, {
        includeItems: true,
        includeHistory: true,
        includeActor: INTERNAL_ROLES.includes(context.role),
      }),
    );
  } catch (error) {
    return handleOrderError(error, res);
  }
});

module.exports = router;
