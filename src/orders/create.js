const { Router } = require("express");
const { validateRequest } = require("../auth/request-validator");
const { orderAccess } = require("./guards");
const { orderService } = require("./service");
const { toPublicOrder } = require("./serializer");
const { handleOrderError } = require("./shared");
const { CREATE_FIELDS, createOrderSchema } = require("./validators");

const router = Router();

/**
 * @openapi
 * /orders:
 *   post:
 *     summary: Creates a draft order
 *     description: >
 *       Requires a customer, administrator or seller JWT. A customer uses the
 *       profile linked to `users.customer_id` and cannot send `customer_id`.
 *       Admins and sellers must send `customer_id`; a seller only operates on
 *       customers assigned in `customer_sellers`. The order is born in `draft`,
 *       prices are snapshotted but no stock is reserved. `items` is optional
 *       (0–50 lines).
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
 *             properties:
 *               customer_id:
 *                 type: integer
 *                 minimum: 1
 *                 description: Required for admin/seller, forbidden for customer
 *               items:
 *                 type: array
 *                 maxItems: 50
 *                 items: { $ref: '#/components/schemas/OrderItemInput' }
 *               delivery_address:
 *                 type: string
 *                 maxLength: 500
 *                 description: Falls back to customers.direction
 *               notes: { type: string, maxLength: 1000, nullable: true }
 *               payment_term_id:
 *                 type: integer
 *                 minimum: 1
 *                 nullable: true
 *     responses:
 *       201:
 *         description: Order created in draft
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/OrderDetail' }
 *       400:
 *         description: Missing customer_id for an internal role
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorMessage' }
 *             example: { message: customer_id is required }
 *       401:
 *         description: Missing, invalid or expired token
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorMessage' }
 *       403:
 *         description: Role without permission, unlinked customer, missing list or unassigned seller
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorMessage' }
 *       404:
 *         description: Target customer does not exist
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorMessage' }
 *       409:
 *         description: Duplicated product and item state pair
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorMessage' }
 *             example: { message: Product and item state already in order }
 *       422:
 *         description: Invalid line, item state or price
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ValidationErrors' }
 *       503:
 *         description: Missing default currency or incomplete status catalog
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorMessage' }
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post(
  "/",
  ...orderAccess(),
  validateRequest({ schema: createOrderSchema, fields: [...CREATE_FIELDS] }),
  async (req, res) => {
    try {
      const order = await orderService.createOrder(req.validated, req.user);

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

module.exports = router;
