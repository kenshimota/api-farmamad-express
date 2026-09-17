const { Router } = require("express");
const { authenticate } = require("../auth/middleware");
const { authorize } = require("../auth/authorize");
const { validateRequest } = require("../auth/request-validator");
const { toPublicCustomer } = require("./serializer");
const {
  createCustomerSchema,
  REQUIRED_CUSTOMER_FIELDS,
} = require("./validators");
const { handleWriteError, loadCustomer } = require("./shared");

const router = Router();

/**
 * @openapi
 * /customers/{id}:
 *   put:
 *     summary: Updates every public field of a customer; only administrators and sellers can do it
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
 *     responses:
 *       200:
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
  async (req, res) => {
    try {
      await req.customer.update(req.validated);

      return res.json(toPublicCustomer(req.customer));
    } catch (error) {
      return handleWriteError(error, res);
    }
  },
);

module.exports = router;
