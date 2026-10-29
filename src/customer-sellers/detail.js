const { Router } = require("express");
const { toPublicCustomerSeller } = require("./serializer");
const { loadAssignment } = require("./shared");
const { readAccess, requireAssignmentOwnership } = require("./guards");

const router = Router();

/**
 * @openapi
 * /customer-sellers/{id}:
 *   get:
 *     summary: Returns one assignment; admin, dispatcher and its seller
 *     description: >
 *       Returns the assignment with its nested customer and seller. A seller
 *       can only read assignments where they are the seller; another seller's
 *       assignment answers 403. An invalid id answers 422 and an unknown
 *       assignment answers 404.
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
 *       200:
 *         description: Public assignment with its nested relations
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/CustomerSeller' }
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
router.get(
  "/:id",
  ...readAccess(),
  loadAssignment,
  requireAssignmentOwnership,
  (req, res) => res.json(toPublicCustomerSeller(req.customerSeller)),
);

module.exports = router;
