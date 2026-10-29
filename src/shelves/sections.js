const { Router } = require("express");
const { toPublicSection } = require("./serializer");
const {
  REQUIRED_SECTION_FIELDS,
  createSectionSchema,
} = require("./validators");
const { loadRouteShelf } = require("./shared");
const { validatedBody, writeAccess } = require("./guards");
const { sectionService } = require("./section-service");
const { handleSectionWriteError } = require("./errors");
const listRouter = require("./section-list");
const detailRouter = require("./section-detail");
const updateRouter = require("./section-update");
const removeRouter = require("./section-remove");

const router = Router();

/**
 * @openapi
 * /shelves/{shelf_id}/sections:
 *   post:
 *     summary: Creates a section inside a shelf; admin and manager_warehouse
 *     description: >
 *       `code` is required, trimmed, uppercased and unique inside the shelf
 *       ignoring case. An unknown shelf answers 404 and an invalid `shelf_id`
 *       answers 422.
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
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [code]
 *             properties:
 *               code: { type: string, pattern: '^[A-Za-z0-9_-]{1,50}$', example: A1-03 }
 *               name: { type: string, maxLength: 100, nullable: true, example: Nivel 3 }
 *               description: { type: string, maxLength: 255, nullable: true }
 *     responses:
 *       201:
 *         description: Section created
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ShelfSection' }
 *       400:
 *         description: Missing required fields
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorMessage' }
 *             example: { message: code is required }
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
 *       409:
 *         description: The code already exists in the shelf
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorMessage' }
 *             example: { message: Section already exists }
 *       422:
 *         description: Invalid shelf_id or fields
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ValidationErrors' }
 *             example: { errors: { shelf_id: Invalid shelf id } }
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post(
  "/:shelf_id/sections",
  ...writeAccess(),
  loadRouteShelf,
  ...validatedBody(createSectionSchema, [...REQUIRED_SECTION_FIELDS]),
  async (req, res) => {
    try {
      const section = await sectionService.createSection(
        req.shelf,
        req.validated,
      );

      return res.status(201).json(toPublicSection(section));
    } catch (error) {
      return handleSectionWriteError(error, res);
    }
  },
);

router.use(listRouter);
router.use(detailRouter);
router.use(updateRouter);
router.use(removeRouter);

module.exports = router;
