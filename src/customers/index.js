const { Router } = require("express");
const Customer = require("../models/customer");
const { authenticate } = require("../auth/middleware");
const { authorize } = require("../auth/authorize");
const { validateRequest } = require("../auth/request-validator");
const { toPublicCustomer } = require("./serializer");
const {
  createCustomerSchema,
  REQUIRED_CUSTOMER_FIELDS,
} = require("./validators");
const { handleWriteError } = require("./shared");
const listRouter = require("./list");
const updateRouter = require("./update");
const removeRouter = require("./remove");

const router = Router();

/**
 * @openapi
 * /customers:
 *   post:
 *     summary: Registers a customer; only administrators and sellers can do it
 *     tags:
 *       - Customers
 *     security:
 *       - bearerAuth: []
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
 *                 example: Juan Pérez
 *               latitude:
 *                 type: number
 *                 minimum: -90
 *                 maximum: 90
 *                 example: -17.7833
 *               longitude:
 *                 type: number
 *                 minimum: -180
 *                 maximum: 180
 *                 example: -63.1821
 *               direction:
 *                 type: string
 *                 example: Av. Monseñor Rivero 123
 *               email:
 *                 type: string
 *                 format: email
 *                 example: juan@example.com
 *               isRegistered:
 *                 type: boolean
 *                 description: Optional; defaults to false
 *                 example: false
 *     responses:
 *       201:
 *         description: Customer created
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
 *         $ref: '#/components/responses/NotFound'
 *       409:
 *         description: Email already registered
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *             example:
 *               message: Customer already exists
 *       422:
 *         description: Invalid fields
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ValidationErrors'
 *             example:
 *               errors:
 *                 latitude: Latitud inválida
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post(
  "/",
  authenticate,
  authorize("admin", "seller"),
  validateRequest({
    schema: createCustomerSchema,
    fields: REQUIRED_CUSTOMER_FIELDS,
  }),
  async (req, res) => {
    try {
      const customer = await Customer.create(req.validated);

      return res.status(201).json(toPublicCustomer(customer));
    } catch (error) {
      return handleWriteError(error, res);
    }
  },
);

router.use(listRouter);
router.use(updateRouter);
router.use(removeRouter);

module.exports = router;
