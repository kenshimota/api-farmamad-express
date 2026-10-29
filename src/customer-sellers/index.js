const { Router } = require("express");
const { toPublicCustomerSeller } = require("./serializer");
const {
  createCustomerSellerSchema,
  REQUIRED_ASSIGNMENT_FIELDS,
} = require("./validators");
const {
  requireSelfAssignment,
  validatedBody,
  writeAccess,
} = require("./guards");
const { customerSellerService } = require("./service");
const { handleWriteError } = require("./errors");
const listRouter = require("./list");
const detailRouter = require("./detail");
const updateRouter = require("./update");
const removeRouter = require("./remove");

const router = Router();

/**
 * @openapi
 * /customer-sellers:
 *   post:
 *     summary: Assigns a customer to a seller; admin and seller
 *     description: >
 *       Requires `customer_id` and `seller_id`. The customer and the seller
 *       must exist, the seller must have the `seller` role and must not be
 *       blocked, and a customer can have at most one seller. Administrators can
 *       assign any valid seller; a seller can only assign themselves. A
 *       duplicated assignment answers 409 and the database unique constraint
 *       also protects two concurrent requests. `assigned_at` is set by the
 *       server and client supplied values are ignored.
 *     tags:
 *       - Customer sellers
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [customer_id, seller_id]
 *             properties:
 *               customer_id: { type: integer, minimum: 1, example: 8 }
 *               seller_id: { type: integer, minimum: 1, example: 12 }
 *     responses:
 *       201:
 *         description: Assignment created
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/CustomerSeller' }
 *       400:
 *         description: Missing required fields
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorMessage' }
 *             example: { message: customer_id and seller_id are required }
 *       401:
 *         description: Missing, invalid or expired token
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorMessage' }
 *       403:
 *         description: Role without permission, blocked user or seller assigning someone else
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorMessage' }
 *             example: { message: Forbidden }
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       409:
 *         description: The customer already has a seller
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorMessage' }
 *             example: { message: Customer already has a seller }
 *       422:
 *         description: Invalid customer or seller
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ValidationErrors' }
 *             example: { errors: { seller_id: Invalid seller } }
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post(
  "/",
  ...writeAccess(),
  ...validatedBody(createCustomerSellerSchema, REQUIRED_ASSIGNMENT_FIELDS),
  requireSelfAssignment,
  async (req, res) => {
    try {
      const assignment = await customerSellerService.createAssignment(
        req.validated,
      );

      return res.status(201).json(toPublicCustomerSeller(assignment));
    } catch (error) {
      return handleWriteError(error, res);
    }
  },
);

router.use(listRouter);
router.use(detailRouter);
router.use(updateRouter);
router.use(removeRouter);

module.exports = router;
