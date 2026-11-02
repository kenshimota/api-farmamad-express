const { Router } = require("express");
const { loadPaymentTerm } = require("./shared");
const { access } = require("./guards");
const { paymentTermService } = require("./service");
const { handlePaymentTermDeleteError } = require("./errors");

const router = Router();

/**
 * @openapi
 * /payment-terms/{id}:
 *   delete:
 *     summary: Deletes a payment term; only administrators and sellers can do it
 *     description: >
 *       A term assigned to a customer, order or invoice cannot be removed: it
 *       responds 409 with `Payment term is in use`. Unused terms are deleted
 *       physically and answer 204 without a body.
 *     tags:
 *       - Payment terms
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer, minimum: 1 }
 *         example: 4
 *     responses:
 *       204:
 *         description: Payment term deleted; the response has no body
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
 *         description: The payment term does not exist
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorMessage' }
 *             example: { message: Payment term not found }
 *       409:
 *         description: The term is assigned to a customer, order or invoice
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorMessage' }
 *             example: { message: Payment term is in use }
 *       422:
 *         description: Invalid payment term id
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ValidationErrors' }
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.delete("/:id", ...access(), loadPaymentTerm, async (req, res) => {
  try {
    await paymentTermService.deletePaymentTerm(req.paymentTerm);

    return res.status(204).send();
  } catch (error) {
    return handlePaymentTermDeleteError(error, res);
  }
});

module.exports = router;
