const { Router } = require("express");
const { validateRequest } = require("../auth/request-validator");
const { writeAccess } = require("./guards");
const { orderStatusService } = require("./service");
const { toPublicOrderStatus } = require("./serializer");
const { handleOrderStatusError, parsePositiveId } = require("./shared");
const {
  createOrderStatusSchema,
  updateOrderStatusSchema,
} = require("./validators");

const router = Router();
const CREATE_FIELDS = Object.freeze(["code", "name", "sort_order"]);
const UPDATE_FIELDS = Object.freeze([]);

/**
 * @openapi
 * /order-statuses:
 *   post:
 *     summary: Creates an additional order status
 *     description: >
 *       Administrators only. The new status is always `is_system: false`.
 *       `next_status_code` must exist, cannot be the same code and cannot
 *       create a cycle.
 *     tags:
 *       - Order statuses
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [code, name, sort_order]
 *             properties:
 *               code:
 *                 type: string
 *                 pattern: '^[a-z][a-z0-9_]{1,19}$'
 *                 example: on_hold
 *               name: { type: string, maxLength: 100, example: En espera }
 *               description:
 *                 type: string
 *                 maxLength: 255
 *                 nullable: true
 *                 example: Esperando confirmación
 *               sort_order: { type: integer, minimum: 0, example: 25 }
 *               next_status_code:
 *                 type: string
 *                 nullable: true
 *                 example: generate
 *     responses:
 *       201:
 *         description: The created status
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/OrderStatus' }
 *       400:
 *         description: Missing required fields
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
 *         description: Referenced destination was not found
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorMessage' }
 *       409:
 *         description: Duplicated code
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorMessage' }
 *       422:
 *         description: Invalid field, unknown destination or cycle
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ValidationErrors' }
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post(
  "/",
  ...writeAccess(),
  validateRequest({
    schema: createOrderStatusSchema,
    fields: [...CREATE_FIELDS],
  }),
  async (req, res) => {
    try {
      const status = await orderStatusService.create(req.validated);

      return res.status(201).json(toPublicOrderStatus(status));
    } catch (error) {
      return handleOrderStatusError(error, res);
    }
  },
);

/**
 * @openapi
 * /order-statuses/{id}:
 *   put:
 *     summary: Updates the mutable fields of an order status
 *     description: >
 *       Administrators only. Updates `name`, `description`, `sort_order` and
 *       `next_status_code`; `code` and `is_system` are immutable. Changing the
 *       chain validates that the destination exists and no cycle is created.
 *     tags:
 *       - Order statuses
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer, minimum: 1 }
 *         example: 2
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string, maxLength: 100 }
 *               description: { type: string, maxLength: 255, nullable: true }
 *               sort_order: { type: integer, minimum: 0 }
 *               next_status_code: { type: string, nullable: true }
 *     responses:
 *       200:
 *         description: The updated status
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
 *       422:
 *         description: Invalid id, field, destination or cycle
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ValidationErrors' }
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.put(
  "/:id",
  ...writeAccess(),
  validateRequest({
    schema: updateOrderStatusSchema,
    fields: [...UPDATE_FIELDS],
  }),
  async (req, res) => {
    const id = parsePositiveId(req.params.id);

    if (id === null) {
      return res
        .status(422)
        .json({ errors: { id: "Invalid order status id" } });
    }

    try {
      const status = await orderStatusService.update(id, req.validated);

      return res.json(toPublicOrderStatus(status));
    } catch (error) {
      return handleOrderStatusError(error, res);
    }
  },
);

/**
 * @openapi
 * /order-statuses/{id}:
 *   delete:
 *     summary: Deletes an additional order status
 *     description: >
 *       Administrators only. The five base statuses answer 409 with
 *       `{ "message": "System order status cannot be deleted" }`; a status
 *       referenced by orders, history or as `next_status_code` answers 409
 *       with `{ "message": "Order status is in use" }`. Otherwise it answers
 *       204 without body.
 *     tags:
 *       - Order statuses
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer, minimum: 1 }
 *         example: 6
 *     responses:
 *       204:
 *         description: Status deleted; no body
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
 *       409:
 *         description: System status or status in use
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorMessage' }
 *       422:
 *         description: Invalid id
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ValidationErrors' }
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.delete("/:id", ...writeAccess(), async (req, res) => {
  const id = parsePositiveId(req.params.id);

  if (id === null) {
    return res.status(422).json({ errors: { id: "Invalid order status id" } });
  }

  try {
    await orderStatusService.remove(id);

    return res.status(204).send();
  } catch (error) {
    return handleOrderStatusError(error, res);
  }
});

module.exports = router;
