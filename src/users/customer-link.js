const { Router } = require("express");
const sequelize = require("../database");
const User = require("../models/user");
const Customer = require("../models/customer");
const { authenticate } = require("../auth/middleware");
const { authorize } = require("../auth/authorize");
const { getRoleName, toPublicUser } = require("../auth/serializers");
const { formatValidationErrors } = require("../auth/validators");
const { linkCustomerSchema, parseUserId } = require("./validators");
const { findUserForUpdate } = require("./target");
const {
  CUSTOMER_LINKED_MESSAGE,
  attachCustomer,
  isCustomerLinkUniqueError,
} = require("./customer-link-shared");

const router = Router();

const NOT_CUSTOMER_MESSAGE = "User is not a customer";
const INVALID_CUSTOMER_MESSAGE = "Invalid customer";

/**
 * @openapi
 * /users/{id}/customer:
 *   put:
 *     summary: Links or unlinks a customer account; only administrators can do it
 *     description: >-
 *       Links the user to a customer when `customer_id` is a positive integer,
 *       or removes the link when it is `null`. The user must have the
 *       `customer` role, the customer must exist and no other user may be
 *       linked to it. Sending the same customer again is idempotent.
 *     tags:
 *       - Users
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *         example: 12
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - customer_id
 *             properties:
 *               customer_id:
 *                 type: integer
 *                 minimum: 1
 *                 nullable: true
 *                 example: 8
 *     responses:
 *       202:
 *         description: Updated public user with its customer link
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       400:
 *         description: Missing customer_id
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *             example:
 *               message: customer_id is required
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
 *         description: The user does not exist
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *             example:
 *               message: User not found
 *       409:
 *         description: The customer is linked to another user
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *             example:
 *               message: Customer is already linked to a user
 *       422:
 *         description: Invalid id, value, role or customer
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ValidationErrors'
 *             example:
 *               errors:
 *                 customer_id: Invalid customer id
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.put(
  "/:id/customer",
  authenticate,
  authorize("admin"),
  async (req, res) => {
    const id = parseUserId(req.params.id);

    if (id === null) {
      return res.status(422).json({ errors: { id: "Invalid user id" } });
    }

    const body = req.body ?? {};

    if (
      !Object.prototype.hasOwnProperty.call(body, "customer_id") ||
      body.customer_id === undefined
    ) {
      return res.status(400).json({ message: "customer_id is required" });
    }

    let data;
    try {
      data = await linkCustomerSchema.validate(body, {
        abortEarly: false,
        stripUnknown: true,
      });
    } catch (error) {
      return res.status(422).json({ errors: formatValidationErrors(error) });
    }

    const result = await sequelize.transaction(async (transaction) => {
      const user = await findUserForUpdate(id, { transaction });

      if (!user) {
        return { status: 404 };
      }

      if (getRoleName(user) !== "customer") {
        return {
          status: 422,
          body: { errors: { customer_id: NOT_CUSTOMER_MESSAGE } },
        };
      }

      if (data.customer_id === null) {
        await user.update({ customer_id: null }, { transaction });
        attachCustomer(user, null);

        return { status: 202, user };
      }

      const customer = await Customer.findByPk(data.customer_id, {
        transaction,
      });

      if (!customer) {
        return {
          status: 422,
          body: { errors: { customer_id: INVALID_CUSTOMER_MESSAGE } },
        };
      }

      const linkedUser = await User.findOne({
        where: { customer_id: data.customer_id },
        transaction,
      });

      if (linkedUser && linkedUser.id !== user.id) {
        return { status: 409, body: { message: CUSTOMER_LINKED_MESSAGE } };
      }

      if (user.customer_id !== data.customer_id) {
        try {
          await user.update({ customer_id: data.customer_id }, { transaction });
        } catch (error) {
          if (isCustomerLinkUniqueError(error)) {
            return { status: 409, body: { message: CUSTOMER_LINKED_MESSAGE } };
          }

          throw error;
        }
      }

      attachCustomer(user, customer);

      return { status: 202, user };
    });

    if (result.status === 404) {
      return res.status(404).json({ message: "User not found" });
    }

    if (result.body) {
      return res.status(result.status).json(result.body);
    }

    return res
      .status(202)
      .json(toPublicUser(result.user, undefined, { includeCustomer: true }));
  },
);

module.exports = router;
