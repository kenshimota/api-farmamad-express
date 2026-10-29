const { Router } = require("express");
const { toPublicSection } = require("./serializer");
const { loadRouteShelf } = require("./shared");
const { readAccess } = require("./guards");
const { sectionService } = require("./section-service");

const router = Router();

/**
 * @openapi
 * /shelves/{shelf_id}/sections:
 *   get:
 *     summary: Lists the sections of a shelf; read roles
 *     description: >
 *       Returns the sections ordered by `code` ascending. An unknown shelf
 *       answers 404 and an invalid `shelf_id` answers 422.
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
 *     responses:
 *       200:
 *         description: Sections ordered by code
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items: { $ref: '#/components/schemas/ShelfSection' }
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
 *         description: The shelf does not exist
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorMessage' }
 *             example: { message: Shelf not found }
 *       422:
 *         description: Invalid shelf_id
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ValidationErrors' }
 *             example: { errors: { shelf_id: Invalid shelf id } }
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get(
  "/:shelf_id/sections",
  ...readAccess(),
  loadRouteShelf,
  async (req, res) => {
    const sections = await sectionService.listSections(req.shelf.id);

    return res.json(sections.map((section) => toPublicSection(section)));
  },
);

module.exports = router;
