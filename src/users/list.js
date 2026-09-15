const { Router } = require("express");
const User = require("../models/user");
const Role = require("../models/role");
const { authenticate } = require("../auth/middleware");
const { authorize } = require("../auth/authorize");
const { toPublicUser } = require("../auth/serializers");

const router = Router();

/**
 * @openapi
 * /users:
 *   get:
 *     summary: Lists every registered user; only administrators can do it
 *     tags:
 *       - Users
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Users ordered by id ascending, without password or roleId
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/User'
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
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get("/", authenticate, authorize("admin"), async (req, res) => {
  const users = await User.findAll({
    include: { model: Role, as: "role" },
    order: [["id", "ASC"]],
  });

  return res.json(users.map((user) => toPublicUser(user)));
});

module.exports = router;
