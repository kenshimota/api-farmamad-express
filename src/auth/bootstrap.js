const { Router } = require("express");
const User = require("../models/user");
const sequelize = require("../database");
const { ADMIN_ROLE, findRoleByName } = require("./roles");
const { toPublicUser } = require("./serializers");
const { notifyWelcomeUser } = require("./welcome");
const {
  registerAdminSchema,
  formatValidationErrors,
  missingFields,
  requiredFieldsMessage,
} = require("./validators");

const router = Router();

const REQUIRED_FIELDS = ["username", "email", "password"];

/**
 * @openapi
 * /auth/setup-status:
 *   get:
 *     summary: Reports whether the system already has an administrator
 *     tags:
 *       - Auth
 *     responses:
 *       200:
 *         description: Bootstrap status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 hasAdmin:
 *                   type: boolean
 *                   example: false
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get("/setup-status", async (req, res) => {
  const adminRole = await findRoleByName(ADMIN_ROLE);

  if (!adminRole) {
    return res.json({ hasAdmin: false });
  }

  const admins = await User.count({ where: { roleId: adminRole.id } });

  return res.json({ hasAdmin: admins > 0 });
});

/**
 * @openapi
 * /auth/register-admin:
 *   post:
 *     summary: Registers the initial administrator when none exists
 *     description: >-
 *       Creates the first administrator and sends a welcome email to the given
 *       address. A delivery failure does not change the response.
 *     tags:
 *       - Auth
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
 *             properties:
 *               username:
 *                 type: string
 *                 example: admin
 *               email:
 *                 type: string
 *                 format: email
 *                 example: admin@superking.com
 *               password:
 *                 type: string
 *                 format: password
 *                 minLength: 8
 *                 example: secreto123
 *               name:
 *                 type: string
 *                 nullable: true
 *                 example: Administrador
 *     responses:
 *       201:
 *         description: Administrator created
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
 *               message: username, email and password are required
 *       409:
 *         description: An administrator already exists
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *             example:
 *               message: Admin already exists
 *       422:
 *         description: Invalid fields
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ValidationErrors'
 *             example:
 *               errors:
 *                 email: Invalid email
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post("/register-admin", async (req, res) => {
  const body = req.body ?? {};
  const missing = missingFields(body, REQUIRED_FIELDS);

  if (missing.length) {
    return res.status(400).json({ message: requiredFieldsMessage(missing) });
  }

  let data;
  try {
    data = await registerAdminSchema.validate(body, {
      abortEarly: false,
      stripUnknown: true,
    });
  } catch (error) {
    return res.status(422).json({ errors: formatValidationErrors(error) });
  }

  const result = await sequelize.transaction(async (transaction) => {
    const adminRole = await findRoleByName(ADMIN_ROLE, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!adminRole) {
      return { status: 500 };
    }

    const existing = await User.findOne({
      where: { roleId: adminRole.id },
      transaction,
    });

    if (existing) {
      return { status: 409 };
    }

    const user = await User.create(
      { ...data, roleId: adminRole.id },
      { transaction },
    );

    return { status: 201, user, role: adminRole.name };
  });

  if (result.status === 409) {
    return res.status(409).json({ message: "Admin already exists" });
  }

  if (result.status === 500) {
    return res.status(500).json({ message: "Server error" });
  }

  await notifyWelcomeUser(result.user);

  return res.status(201).json(toPublicUser(result.user, result.role));
});

module.exports = router;
