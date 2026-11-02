const { Router } = require("express");
const { authenticate } = require("../auth/middleware");
const { authorize } = require("../auth/authorize");
const { paymentService } = require("./service");
const { handlePaymentError } = require("./errors");
const { loadPayment } = require("./shared");

const router = Router();

/**
 * @openapi
 * /payments/{id}:
 *   delete:
 *     summary: Deletes a payment and reverts its deposit; only admin
 *     description: >
 *       Refuses with 409 when the payment has invoice allocations. Otherwise,
 *       inside one transaction it removes the `deposit` movement, decrements
 *       the wallet and deletes the payment. A wallet cannot be left with a
 *       negative balance, so that case also answers 409. Responds 204 with no
 *       body on success.
 *     tags:
 *       - Payments
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
 *         description: Payment deleted; the response has no body
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
 *         description: The payment does not exist
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorMessage' }
 *       409:
 *         description: The payment has allocations or would leave a negative balance
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorMessage' }
 *             example: { message: Payment has allocations }
 *       422:
 *         description: Invalid payment id
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ValidationErrors' }
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.delete(
  "/:id",
  authenticate,
  authorize("admin"),
  loadPayment,
  async (req, res) => {
    try {
      await paymentService.deletePayment(req.payment);

      return res.status(204).send();
    } catch (error) {
      return handlePaymentError(error, res);
    }
  },
);

module.exports = router;
