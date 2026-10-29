const { Router } = require("express");
const { UniqueConstraintError } = require("sequelize");
const User = require("../models/user");
const { authenticate } = require("../auth/middleware");
const { authorize } = require("../auth/authorize");
const { findRoleByName } = require("../auth/roles");
const { toPublicUser } = require("../auth/serializers");
const {
  formatValidationErrors,
  missingFields,
  requiredFieldsMessage,
} = require("../auth/validators");
const { createUserSchema, REQUIRED_USER_FIELDS } = require("./validators");
const { notifyWelcomeUser } = require("../auth/welcome");
const listRouter = require("./list");
const statusRouter = require("./status");
const removeRouter = require("./remove");

const router = Router();

/**
 * @openapi
 * /users:
 *   post:
 *     summary: Creates a user; only administrators can do it
 *     description: >-
 *       Creates the user and sends a welcome email to the given address. A
 *       delivery failure does not change the response. The `role` must be one
 *       of the names returned by `GET /roles`.
 *     tags:
 *       - Users
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - email
 *               - password
 *               - role
 *             properties:
 *               username:
 *                 type: string
 *                 example: maria
 *               email:
 *                 type: string
 *                 format: email
 *                 example: maria@superking.com
 *               password:
 *                 type: string
 *                 format: password
 *                 minLength: 8
 *                 example: secreto123
 *               name:
 *                 type: string
 *                 nullable: true
 *                 example: María
 *               role:
 *                 type: string
 *                 description: >-
 *                   Role name from the catalog: admin, customer, seller,
 *                   dispatcher, manager_warehouse or support.
 *                 enum:
 *                   - admin
 *                   - customer
 *                   - seller
 *                   - dispatcher
 *                   - manager_warehouse
 *                   - support
 *                 example: seller
 *     responses:
 *       201:
 *         description: User created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       400:
 *         description: Missing required fields
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *             example:
 *               message: username, email, password and role are required
 *       401:
 *         description: Missing, invalid or expired token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *             example:
 *               message: Unauthorized
 *       403:
 *         description: Authenticated user without the administrator role
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *             example:
 *               message: Forbidden
 *       409:
 *         description: Username or email already registered
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *             example:
 *               message: User already exists
 *       422:
 *         description: Invalid fields or unknown role
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ValidationErrors'
 *             example:
 *               errors:
 *                 role: Invalid role
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post("/", authenticate, authorize("admin"), async (req, res) => {
  const body = req.body ?? {};
  const missing = missingFields(body, REQUIRED_USER_FIELDS);

  if (missing.length) {
    return res.status(400).json({ message: requiredFieldsMessage(missing) });
  }

  let data;
  try {
    data = await createUserSchema.validate(body, {
      abortEarly: false,
      stripUnknown: true,
    });
  } catch (error) {
    return res.status(422).json({ errors: formatValidationErrors(error) });
  }

  const role = await findRoleByName(data.role);

  if (!role) {
    return res.status(422).json({ errors: { role: "Invalid role" } });
  }

  let user;
  try {
    user = await User.create({ ...data, roleId: role.id });
  } catch (error) {
    if (error instanceof UniqueConstraintError) {
      return res.status(409).json({ message: "User already exists" });
    }

    throw error;
  }

  await notifyWelcomeUser(user);

  return res.status(201).json(toPublicUser(user, role.name));
});

router.use(listRouter);
router.use(statusRouter);
router.use(removeRouter);

module.exports = router;
