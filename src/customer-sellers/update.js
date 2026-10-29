const { Router } = require("express");
const { toPublicCustomerSeller } = require("./serializer");
const { loadAssignment } = require("./shared");
const {
  requireAssignmentOwnership,
  requireSelfAssignment,
  validatedBody,
  writeAccess,
} = require("./guards");
const {
  UPDATE_ASSIGNMENT_FIELDS,
  updateCustomerSellerSchema,
} = require("./validators");
const { customerSellerService } = require("./service");
const { customerCannotChange, handleWriteError } = require("./errors");

const router = Router();

/**
 * @openapi
 * /customer-sellers/{id}:
 *   put:
 *     summary: Reassigns the seller of an assignment; admin and seller
 *     description: >
 *       Requires `seller_id`. Administrators can reassign to any valid seller.
 *       A seller can only update their own assignment and the new seller must
 *       be themselves. `customer_id` is immutable: sending a different value
 *       answers 422 `customer_id cannot be changed`. The new seller must exist,
 *       have the `seller` role and not be blocked. `assigned_at` is refreshed by
 *       the server, and the response is 202 as every PUT in this API.
 *     tags:
 *       - Customer sellers
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer, minimum: 1 }
 *         example: 1
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [seller_id]
 *             properties:
 *               seller_id: { type: integer, minimum: 1, example: 15 }
 *               customer_id:
 *                 type: integer
 *                 description: Optional; only the stored value is accepted
 *                 example: 8
 *     responses:
 *       202:
 *         description: Updated assignment with assigned_at refreshed
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/CustomerSeller' }
 *       400:
 *         description: Missing seller_id
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorMessage' }
 *             example: { message: seller_id is required }
 *       401:
 *         description: Missing, invalid or expired token
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorMessage' }
 *       403:
 *         description: Role without permission, another seller's assignment or seller handing it away
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorMessage' }
 *             example: { message: Forbidden }
 *       404:
 *         description: The assignment does not exist
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorMessage' }
 *             example: { message: Assignment not found }
 *       422:
 *         description: Invalid seller or immutable customer
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ValidationErrors' }
 *             example: { errors: { seller_id: Invalid seller } }
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.put(
  "/:id",
  ...writeAccess(),
  ...validatedBody(updateCustomerSellerSchema, UPDATE_ASSIGNMENT_FIELDS),
  loadAssignment,
  requireAssignmentOwnership,
  requireSelfAssignment,
  async (req, res) => {
    if (
      req.validated.customer_id !== undefined &&
      Number(req.validated.customer_id) !==
        Number(req.customerSeller.customer_id)
    ) {
      return handleWriteError(customerCannotChange(), res);
    }

    try {
      const assignment = await customerSellerService.updateAssignment(
        req.customerSeller,
        req.validated,
      );

      return res.status(202).json(toPublicCustomerSeller(assignment));
    } catch (error) {
      return handleWriteError(error, res);
    }
  },
);

module.exports = router;
