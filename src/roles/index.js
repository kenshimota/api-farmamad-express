const { Router } = require("express");
const Role = require("../models/role");
const { authenticate } = require("../auth/middleware");
const { authorize } = require("../auth/authorize");

const router = Router();

/**
 * Builds the public representation of a role: only the identifier and the
 * name are exposed, so the audit columns (createdAt/updatedAt) never leak.
 * @param {object} role - Role instance or plain object.
 * @returns {{ id: number, name: string }} The public role data.
 */
function toPublicRole(role) {
  return { id: role.id, name: role.name };
}

/**
 * @openapi
 * /roles:
 *   get:
 *     summary: Lists the role catalog; only administrators can do it
 *     description: >
 *       Returns every role stored in the roles table, ordered by id ascending.
 *       The `name` values are the ones accepted by `POST /users`, so a client
 *       can use this endpoint to populate a role selector.
 *     tags:
 *       - Roles
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Roles ordered by id ascending, with only id and name
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Role'
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
  const roles = await Role.findAll({ order: [["id", "ASC"]] });

  return res.json(roles.map((role) => toPublicRole(role)));
});

module.exports = router;
