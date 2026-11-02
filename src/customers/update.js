const { Router } = require("express");
const { authenticate } = require("../auth/middleware");
const { authorize } = require("../auth/authorize");
const { validateRequest } = require("../auth/request-validator");
const { toPublicCustomer } = require("./serializer");
const {
  createCustomerSchema,
  REQUIRED_CUSTOMER_FIELDS,
} = require("./validators");
const {
  ensurePaymentTermAssignment,
  ensurePriceListAssignment,
  handleWriteError,
  loadCustomer,
  reloadCustomer,
} = require("./shared");

const router = Router();

/**
 * @openapi
 * /customers/{id}:
 *   put:
 *     summary: Updates every public field of a customer; only administrators and sellers can do it
 *     description: >
 *       Updates an existing customer. As with every PUT endpoint, a successful
 *       update responds 202 Accepted with the updated resource in the body.
 *     tags:
 *       - Customers
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *         example: 1
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - fullName
 *               - latitude
 *               - longitude
 *               - direction
 *               - email
 *             properties:
 *               fullName:
 *                 type: string
 *                 example: Juan Pérez Gómez
 *               latitude:
 *                 type: number
 *                 minimum: -90
 *                 maximum: 90
 *                 example: -17.79
 *               longitude:
 *                 type: number
 *                 minimum: -180
 *                 maximum: 180
 *                 example: -63.19
 *               direction:
 *                 type: string
 *                 example: Av. Monseñor Rivero 456
 *               email:
 *                 type: string
 *                 format: email
 *                 example: juan@example.com
 *               isRegistered:
 *                 type: boolean
 *                 description: Optional; when omitted the stored value is kept
 *                 example: false
 *               price_list_id:
 *                 type: integer
 *                 minimum: 1
 *                 nullable: true
 *                 description: >
 *                   Optional; omitted keeps the current list, `null` clears it
 *                   and an integer replaces it.
 *                 example: 1
 *               payment_term_id:
 *                 type: integer
 *                 minimum: 1
 *                 nullable: true
 *                 description: >
 *                   Optional; omitted keeps the current term, `null` clears it
 *                   and an integer replaces it when the term is active.
 *                 example: 2
 *     responses:
 *       202:
 *         description: Updated public customer data
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Customer'
 *       400:
 *         description: Missing required fields
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *             example:
 *               message: fullName, latitude, longitude, direction and email are required
 *       401:
 *         description: Missing, invalid or expired token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *             example:
 *               message: Unauthorized
 *       403:
 *         description: Role without permission or blocked user
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *             example:
 *               message: Forbidden
 *       404:
 *         description: The customer does not exist
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *             example:
 *               message: Customer not found
 *       409:
 *         description: The email belongs to another customer
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *             example:
 *               message: Customer already exists
 *       422:
 *         description: Invalid customer id or fields
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ValidationErrors'
 *             example:
 *               errors:
 *                 id: Invalid customer id
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.put(
  "/:id",
  authenticate,
  authorize("admin", "seller"),
  validateRequest({
    schema: createCustomerSchema,
    fields: REQUIRED_CUSTOMER_FIELDS,
  }),
  loadCustomer,
  ensurePriceListAssignment,
  ensurePaymentTermAssignment,
  async (req, res) => {
    try {
      await req.customer.update(req.validated);

      const customer =
        req.validated.price_list_id !== undefined ||
        req.validated.payment_term_id !== undefined
          ? await reloadCustomer(req.customer)
          : req.customer;

      return res.status(202).json(toPublicCustomer(customer));
    } catch (error) {
      return handleWriteError(error, res);
    }
  },
);

module.exports = router;
