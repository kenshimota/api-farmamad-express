const { Router } = require("express");
const sequelize = require("../database");
const { authenticate } = require("../auth/middleware");
const { authorize } = require("../auth/authorize");
const { parseUserId } = require("./validators");
const { isLastActiveAdmin } = require("./admin-guard");
const { findUserForUpdate } = require("./target");

const router = Router();

const NOT_FOUND_MESSAGE = "User not found";
const SELF_DELETE_MESSAGE = "You cannot delete your own account";
const LAST_ADMIN_MESSAGE = "Cannot delete the last administrator";

/**
 * @openapi
 * /users/{id}:
 *   delete:
 *     summary: Deletes a user permanently; only administrators can do it
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
 *     responses:
 *       204:
 *         description: User deleted; the response has no body
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
 *         description: Self delete or last active administrator
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *             example:
 *               message: You cannot delete your own account
 *       422:
 *         description: Invalid id
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ValidationErrors'
 *             example:
 *               errors:
 *                 id: Invalid user id
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.delete("/:id", authenticate, authorize("admin"), async (req, res) => {
  const id = parseUserId(req.params.id);

  if (id === null) {
    return res.status(422).json({ errors: { id: "Invalid user id" } });
  }

  const result = await sequelize.transaction(async (transaction) => {
    const user = await findUserForUpdate(id, { transaction });

    if (!user) {
      return { status: 404 };
    }

    if (Number(req.user.sub) === user.id) {
      return { status: 409, message: SELF_DELETE_MESSAGE };
    }

    if (await isLastActiveAdmin(user, { transaction })) {
      return { status: 409, message: LAST_ADMIN_MESSAGE };
    }

    await user.destroy({ transaction });

    return { status: 204 };
  });

  if (result.status === 404) {
    return res.status(404).json({ message: NOT_FOUND_MESSAGE });
  }

  if (result.status === 409) {
    return res.status(409).json({ message: result.message });
  }

  return res.status(204).send();
});

module.exports = router;
