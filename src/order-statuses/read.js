const { Router } = require("express");
const { readAccess } = require("./guards");
const { orderStatusService } = require("./service");
const { toPublicOrderStatus } = require("./serializer");
const { handleOrderStatusError, parsePositiveId } = require("./shared");

const router = Router();

/**
 * @openapi
 * /order-statuses:
 *   get:
 *     summary: Lists the order status catalog
 *     description: >
 *       Any authenticated customer, seller or administrator can read the
 *       catalog. Rows are ordered by `sort_order` and `id` ascending.
 *       `is_terminal` is derived from `next_status_code === null`.
 *     tags:
 *       - Order statuses
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: The status catalog
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items: { $ref: '#/components/schemas/OrderStatus' }
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
 *         description: No status matches the requested scope
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorMessage' }
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get("/", ...readAccess(), async (req, res) => {
  try {
    const statuses = await orderStatusService.list();

    return res.json(statuses.map((status) => toPublicOrderStatus(status)));
  } catch (error) {
    return handleOrderStatusError(error, res);
  }
});

/**
 * @openapi
 * /order-statuses/{id}:
 *   get:
 *     summary: Returns one order status
 *     tags:
 *       - Order statuses
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer, minimum: 1 }
 *         example: 1
 *     responses:
 *       200:
 *         description: The requested status
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/OrderStatus' }
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
 *         description: Unknown status
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorMessage' }
 *             example: { message: Order status not found }
 *       422:
 *         description: Invalid id
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ValidationErrors' }
 *             example: { errors: { id: Invalid order status id } }
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get("/:id", ...readAccess(), async (req, res) => {
  const id = parsePositiveId(req.params.id);

  if (id === null) {
    return res.status(422).json({ errors: { id: "Invalid order status id" } });
  }

  try {
    const status = await orderStatusService.get(id);

    return res.json(toPublicOrderStatus(status));
  } catch (error) {
    return handleOrderStatusError(error, res);
  }
});

module.exports = router;
