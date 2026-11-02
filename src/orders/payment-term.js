const { Router } = require("express");
const { authenticate } = require("../auth/middleware");
const { authorize } = require("../auth/authorize");
const { validateRequest } = require("../auth/request-validator");
const { toPublicOrder } = require("./serializer");
const { orderService } = require("./service");
const { handleOrderError } = require("./shared");
const { paymentTermUpdateSchema } = require("./validators");

const router = Router();
const ROLES = Object.freeze(["admin", "seller"]);
const POSITIVE_INTEGER_PATTERN = /^\d+$/;

/**
 * Parses a positive integer order id.
 * @param {unknown} value - Raw route parameter.
 * @returns {number|null} The id or null when invalid.
 */
function parseOrderId(value) {
  if (
    typeof value !== "string" ||
    !POSITIVE_INTEGER_PATTERN.test(value.trim())
  ) {
    return null;
  }

  const parsed = Number(value.trim());

  return parsed >= 1 ? parsed : null;
}

/**
 * @openapi
 * /orders/{id}/payment-term:
 *   put:
 *     summary: Changes the payment term of an editable order
 *     description: >
 *       Only administrators and sellers can do it, and only while the order is
 *       in `draft` or `request` (HU-39/#63). The body must send an active
 *       `payment_term_id`. In `generate`, `invoiced`, `cancelled` or any other
 *       non-editable status it answers 422 with
 *       `{ "errors": { "status": "Order is not editable" } }`.
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
 *             required: [payment_term_id]
 *             properties:
 *               payment_term_id: { type: integer, minimum: 1, example: 3 }
 *     responses:
 *       202:
 *         description: Order with the replaced payment term snapshot
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/OrderDetail' }
 *       400:
 *         description: Missing payment_term_id
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorMessage' }
 *             example: { message: payment_term_id is required }
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
 *         description: The order does not exist
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorMessage' }
 *             example: { message: Order not found }
 *       422:
 *         description: Invalid or inactive term, or order is not editable
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ValidationErrors' }
 *             example: { errors: { payment_term_id: Invalid payment term } }
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.put(
  "/:id/payment-term",
  authenticate,
  authorize(...ROLES),
  validateRequest({
    schema: paymentTermUpdateSchema,
    fields: ["payment_term_id"],
  }),
  async (req, res) => {
    const orderId = parseOrderId(req.params.id);

    if (orderId === null) {
      return res.status(422).json({ errors: { id: "Invalid order id" } });
    }

    try {
      const order = await orderService.updatePaymentTerm(
        orderId,
        req.validated,
        req.user,
      );

      return res.status(202).json(
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

module.exports = router;
