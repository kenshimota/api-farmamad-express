const { Router } = require("express");
const { loadMethodPayment } = require("./shared");
const { writeAccess } = require("./guards");
const { methodPaymentService } = require("./service");
const { handleMethodPaymentDeleteError } = require("./errors");

const router = Router();

/**
 * @openapi
 * /method-payments/{id}:
 *   delete:
 *     summary: Deletes a payment method; only administrators can do it
 *     description: >
 *       Permanently deletes the method and responds 204 without body. When a
 *       future order or any other table references it, the foreign key
 *       RESTRICT blocks the deletion and the API answers 409. To stop using a
 *       method without deleting it, update it with `is_active = false`.
 *     tags:
 *       - Method payments
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer, minimum: 1 }
 *         example: 1
 *     responses:
 *       204:
 *         description: Payment method deleted; the response has no body
 *       401:
 *         description: Missing, invalid or expired token
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorMessage' }
 *       403:
 *         description: Role without permission or blocked user
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorMessage' }
 *       404:
 *         description: The payment method does not exist
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorMessage' }
 *             example: { message: Payment method not found }
 *       409:
 *         description: Another table still references the method
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorMessage' }
 *             example: { message: Payment method is in use }
 *       422:
 *         description: Invalid payment method id
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ValidationErrors' }
 *             example: { errors: { id: Invalid payment method id } }
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.delete("/:id", ...writeAccess(), loadMethodPayment, async (req, res) => {
  try {
    await methodPaymentService.deleteMethodPayment(req.methodPayment);

    return res.status(204).send();
  } catch (error) {
    return handleMethodPaymentDeleteError(error, res);
  }
});

module.exports = router;
