const { Router } = require("express");
const { loadMethodPaymentType } = require("./shared");
const { writeAccess } = require("./guards");
const { methodPaymentTypeService } = require("./service");
const { handleMethodPaymentTypeDeleteError } = require("./errors");

const router = Router();

/**
 * @openapi
 * /method-payment-types/{id}:
 *   delete:
 *     summary: Deletes a payment type; only administrators can do it
 *     description: >
 *       Permanently deletes the type and responds 204 without body. When the
 *       type already has concrete payment methods (HU-29), the deletion is
 *       blocked with 409. To stop using a type without deleting it, update it
 *       with `is_active = false`.
 *     tags:
 *       - Method payment types
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
 *         description: Payment type deleted; the response has no body
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
 *         description: The payment type does not exist
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorMessage' }
 *             example: { message: Payment type not found }
 *       409:
 *         description: The type still has concrete payment methods
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorMessage' }
 *             example: { message: Payment type has methods }
 *       422:
 *         description: Invalid payment type id
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ValidationErrors' }
 *             example: { errors: { id: Invalid payment type id } }
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.delete(
  "/:id",
  ...writeAccess(),
  loadMethodPaymentType,
  async (req, res) => {
    try {
      await methodPaymentTypeService.deleteMethodPaymentType(
        req.methodPaymentType,
      );

      return res.status(204).send();
    } catch (error) {
      return handleMethodPaymentTypeDeleteError(error, res);
    }
  },
);

module.exports = router;
