const { Router } = require("express");
const { loadAssignment } = require("./shared");
const { requireAssignmentOwnership, writeAccess } = require("./guards");
const { customerSellerService } = require("./service");
const { handleWriteError } = require("./errors");

const router = Router();

/**
 * @openapi
 * /customer-sellers/{id}:
 *   delete:
 *     summary: Removes an assignment; admin and its seller
 *     description: >
 *       Deletes only the customer-seller relationship and answers 204 without
 *       body. The customer and the seller are not deleted, so the customer can
 *       be assigned again. Administrators can remove any assignment; a seller
 *       can only remove their own and another seller's assignment answers 403.
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
 *     responses:
 *       204:
 *         description: Assignment removed; the response has no body
 *       401:
 *         description: Missing, invalid or expired token
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorMessage' }
 *       403:
 *         description: Role without permission or another seller's assignment
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorMessage' }
 *       404:
 *         description: The assignment does not exist
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorMessage' }
 *             example: { message: Assignment not found }
 *       422:
 *         description: Invalid assignment id
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ValidationErrors' }
 *             example: { errors: { id: Invalid assignment id } }
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.delete(
  "/:id",
  ...writeAccess(),
  loadAssignment,
  requireAssignmentOwnership,
  async (req, res) => {
    try {
      await customerSellerService.deleteAssignment(req.customerSeller);

      return res.status(204).send();
    } catch (error) {
      return handleWriteError(error, res);
    }
  },
);

module.exports = router;
