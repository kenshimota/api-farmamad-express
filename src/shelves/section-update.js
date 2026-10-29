const { Router } = require("express");
const { toPublicSection } = require("./serializer");
const { loadRouteShelf, loadSection } = require("./shared");
const {
  rejectImmutableField,
  requireAnyField,
  validatedBody,
  writeAccess,
} = require("./guards");
const {
  SECTION_UPDATE_FIELDS,
  SHELF_IMMUTABLE_MESSAGE,
  updateSectionSchema,
} = require("./validators");
const { sectionService } = require("./section-service");
const { handleSectionWriteError } = require("./errors");

const router = Router();

/**
 * @openapi
 * /shelves/{shelf_id}/sections/{section_id}:
 *   put:
 *     summary: Updates a section; admin and manager_warehouse
 *     description: >
 *       Updates `code`, `name` and `description`. `shelf_id` is immutable:
 *       sending it answers 422. At least one editable field is required and
 *       the section must belong to the shelf from the route.
 *     tags:
 *       - Shelves
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: shelf_id
 *         required: true
 *         schema: { type: integer, minimum: 1 }
 *       - in: path
 *         name: section_id
 *         required: true
 *         schema: { type: integer, minimum: 1 }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               code: { type: string, pattern: '^[A-Za-z0-9_-]{1,50}$', example: A1-03 }
 *               name: { type: string, maxLength: 100, nullable: true, example: Nivel 3 }
 *               description: { type: string, maxLength: 255, nullable: true }
 *     responses:
 *       202:
 *         description: Updated public section
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ShelfSection' }
 *       400:
 *         description: No editable field was provided
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorMessage' }
 *             example: { message: At least one field is required }
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
 *         description: The code already exists in the shelf
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorMessage' }
 *             example: { message: Section already exists }
 *       422:
 *         description: Invalid ids, invalid fields or immutable shelf_id
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ValidationErrors' }
 *             example: { errors: { shelf_id: shelf_id cannot be changed } }
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.put(
  "/:shelf_id/sections/:section_id",
  ...writeAccess(),
  rejectImmutableField("shelf_id", SHELF_IMMUTABLE_MESSAGE),
  ...validatedBody(updateSectionSchema, []),
  requireAnyField([...SECTION_UPDATE_FIELDS], "At least one field is required"),
  loadRouteShelf,
  loadSection,
  async (req, res) => {
    try {
      const section = await sectionService.updateSection(
        req.section,
        req.validated,
      );

      return res.status(202).json(toPublicSection(section));
    } catch (error) {
      return handleSectionWriteError(error, res);
    }
  },
);

module.exports = router;
