const { Router } = require("express");
const sequelize = require("../database");
const { authenticate } = require("../auth/middleware");
const { authorize } = require("../auth/authorize");
const { toPublicUser } = require("../auth/serializers");
const {
  formatValidationErrors,
  missingFields,
  requiredFieldsMessage,
} = require("../auth/validators");
const { updateUserStatusSchema, parseUserId } = require("./validators");
const { isLastActiveAdmin } = require("./admin-guard");
const { findUserForUpdate } = require("./target");

const router = Router();

const STATUS_FIELDS = ["isBlocked"];
const NOT_FOUND_MESSAGE = "User not found";
const SELF_BLOCK_MESSAGE = "You cannot block your own account";
const LAST_ADMIN_MESSAGE = "Cannot block the last administrator";

/**
 * @openapi
 * /users/{id}/status:
 *   patch:
 *     summary: Blocks or unblocks a user; only administrators can do it
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
 *         example: 2
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - isBlocked
 *             properties:
 *               isBlocked:
 *                 type: boolean
 *                 example: true
 *     responses:
 *       200:
 *         description: Updated public user data
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       400:
 *         description: Missing isBlocked
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *             example:
 *               message: isBlocked is required
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
 *       404:
 *         description: The user does not exist
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *             example:
 *               message: User not found
 *       409:
 *         description: Self block or last active administrator
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *             example:
 *               message: You cannot block your own account
 *       422:
 *         description: Invalid id or isBlocked value
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ValidationErrors'
 *             example:
 *               errors:
 *                 isBlocked: isBlocked must be a boolean
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.patch(
  "/:id/status",
  authenticate,
  authorize("admin"),
  async (req, res) => {
    const id = parseUserId(req.params.id);

    if (id === null) {
      return res.status(422).json({ errors: { id: "Invalid user id" } });
    }

    const body = req.body ?? {};
    const missing = missingFields(body, STATUS_FIELDS);

    if (missing.length) {
      return res.status(400).json({ message: requiredFieldsMessage(missing) });
    }

    let data;
    try {
      data = await updateUserStatusSchema.validate(body, {
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

      if (data.isBlocked && Number(req.user.sub) === user.id) {
        return { status: 409, message: SELF_BLOCK_MESSAGE };
      }

      if (data.isBlocked && (await isLastActiveAdmin(user, { transaction }))) {
        return { status: 409, message: LAST_ADMIN_MESSAGE };
      }

      await user.update({ isBlocked: data.isBlocked }, { transaction });

      return { status: 200, user };
    });

    if (result.status === 404) {
      return res.status(404).json({ message: NOT_FOUND_MESSAGE });
    }

    if (result.status === 409) {
      return res.status(409).json({ message: result.message });
    }

    return res.json(toPublicUser(result.user));
  },
);

module.exports = router;
