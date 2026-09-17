const { Router } = require("express");
const { authenticate } = require("../auth/middleware");
const { authorize } = require("../auth/authorize");
const { loadCustomer } = require("./shared");

const router = Router();

/**
 * @openapi
 * /customers/{id}:
 *   delete:
 *     summary: Deletes a customer permanently; only administrators and sellers can do it
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
 *       204:
 *         description: Customer deleted; the response has no body
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
router.delete(
  "/:id",
  authenticate,
  authorize("admin", "seller"),
  loadCustomer,
  async (req, res) => {
    await req.customer.destroy();

    return res.status(204).send();
  },
);

module.exports = router;
