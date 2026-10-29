const { Router } = require("express");
const { toPublicShelf } = require("./serializer");
const { loadShelf } = require("./shared");
const {
  rejectImmutableField,
  requireAnyField,
  validatedBody,
  writeAccess,
} = require("./guards");
const {
  SHELF_UPDATE_FIELDS,
  WAREHOUSE_IMMUTABLE_MESSAGE,
  updateShelfSchema,
} = require("./validators");
const { shelfService } = require("./shelf-service");
const { handleShelfWriteError } = require("./errors");

const router = Router();

/**
 * @openapi
 * /shelves/{id}:
 *   put:
 *     summary: Updates a shelf; admin and manager_warehouse
 *     description: >
 *       Updates `code`, `name` and `description`. `warehouse_id` is immutable:
 *       sending it answers 422. At least one editable field is required.
 *       A successful update responds 202 with the updated shelf and sections.
 *     tags:
 *       - Shelves
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer, minimum: 1 }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               code: { type: string, pattern: '^[A-Za-z0-9_-]{1,50}$', example: A1 }
 *               name: { type: string, maxLength: 100, nullable: true, example: Estante A1 actualizado }
 *               description: { type: string, maxLength: 255, nullable: true, example: Pasillo principal }
 *     responses:
 *       202:
 *         description: Updated public shelf
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Shelf' }
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
 *         description: The shelf does not exist
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorMessage' }
 *             example: { message: Shelf not found }
 *       409:
 *         description: The code already exists in the warehouse
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorMessage' }
 *             example: { message: Shelf already exists }
 *       422:
 *         description: Invalid id, invalid fields or immutable warehouse_id
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ValidationErrors' }
 *             example: { errors: { warehouse_id: warehouse_id cannot be changed } }
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.put(
  "/:id",
  ...writeAccess(),
  rejectImmutableField("warehouse_id", WAREHOUSE_IMMUTABLE_MESSAGE),
  ...validatedBody(updateShelfSchema, []),
  requireAnyField([...SHELF_UPDATE_FIELDS], "At least one field is required"),
  loadShelf,
  async (req, res) => {
    try {
      const shelf = await shelfService.updateShelf(req.shelf, req.validated);

      return res
        .status(202)
        .json(toPublicShelf(shelf, { includeSections: true }));
    } catch (error) {
      return handleShelfWriteError(error, res);
    }
  },
);

module.exports = router;
