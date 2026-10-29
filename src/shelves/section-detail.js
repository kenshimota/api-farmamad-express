const { Router } = require("express");
const { toPublicSection } = require("./serializer");
const { loadRouteShelf, loadSection } = require("./shared");
const { readAccess } = require("./guards");

const router = Router();

/**
 * @openapi
 * /shelves/{shelf_id}/sections/{section_id}:
 *   get:
 *     summary: Returns one section of a shelf; read roles
 *     description: >
 *       Looks the section up scoped to the shelf from the route, so a section
 *       that belongs to another shelf also answers 404.
 *     tags:
 *       - Shelves
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: shelf_id
 *         required: true
 *         schema: { type: integer, minimum: 1 }
 *         example: 1
 *       - in: path
 *         name: section_id
 *         required: true
 *         schema: { type: integer, minimum: 1 }
 *         example: 1
 *     responses:
 *       200:
 *         description: Public section data
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ShelfSection' }
 *       401:
 *         description: Missing, invalid or expired token
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorMessage' }
 *       403:
 *         description: Role without permission or blocked user
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorMessage' }
 *       404:
 *         description: The shelf or the section does not exist
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorMessage' }
 *             example: { message: Section not found }
 *       422:
 *         description: Invalid shelf_id or section_id
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ValidationErrors' }
 *             example: { errors: { section_id: Invalid section id } }
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get(
  "/:shelf_id/sections/:section_id",
  ...readAccess(),
  loadRouteShelf,
  loadSection,
  (req, res) => res.json(toPublicSection(req.section)),
);

module.exports = router;
