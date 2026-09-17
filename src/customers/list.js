const { Router } = require("express");
const Customer = require("../models/customer");
const { authenticate } = require("../auth/middleware");
const { authorize } = require("../auth/authorize");
const { toPublicCustomer } = require("./serializer");
const { loadCustomer } = require("./shared");

const router = Router();

/**
 * @openapi
 * /customers:
 *   get:
 *     summary: Lists every customer; administrators, sellers and delivery users can do it
 *     tags:
 *       - Customers
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Customers ordered by id ascending with public fields only
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Customer'
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
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get(
  "/",
  authenticate,
  authorize("admin", "seller", "delivery"),
  async (req, res) => {
    const customers = await Customer.findAll({ order: [["id", "ASC"]] });

    return res.json(customers.map((customer) => toPublicCustomer(customer)));
  },
);

/**
 * @openapi
 * /customers/{id}:
 *   get:
 *     summary: Returns one customer; administrators, sellers and delivery users can do it
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
 *     responses:
 *       200:
 *         description: Public customer data
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Customer'
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
 *       422:
 *         description: Invalid customer id
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
router.get(
  "/:id",
  authenticate,
  authorize("admin", "seller", "delivery"),
  loadCustomer,
  (req, res) => res.json(toPublicCustomer(req.customer)),
);

module.exports = router;
