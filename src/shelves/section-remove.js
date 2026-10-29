const { Router } = require("express");
const { loadRouteShelf, loadSection } = require("./shared");
const { writeAccess } = require("./guards");
const { sectionService } = require("./section-service");
const { handleSectionDeleteError } = require("./errors");

const router = Router();

/**
 * @openapi
 * /shelves/{shelf_id}/sections/{section_id}:
 *   delete:
 *     summary: Deletes a section; admin and manager_warehouse
 *     description: >
 *       Deletes the section when no lot references it. When HU-24 lots still
 *       reference it the API answers 409 `Section has lots` and deletes
 *       nothing. A successful delete responds 204 without body.
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
 *       204:
 *         description: Section deleted; the response has no body
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
 *       409:
 *         description: Lots still reference the section
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorMessage' }
 *             example: { message: Section has lots }
 *       422:
 *         description: Invalid shelf_id or section_id
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ValidationErrors' }
 *             example: { errors: { section_id: Invalid section id } }
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.delete(
  "/:shelf_id/sections/:section_id",
  ...writeAccess(),
  loadRouteShelf,
  loadSection,
  async (req, res) => {
    try {
      await sectionService.deleteSection(req.section);

      return res.status(204).send();
    } catch (error) {
      return handleSectionDeleteError(error, res);
    }
  },
);

module.exports = router;
