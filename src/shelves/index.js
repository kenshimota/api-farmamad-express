const { Router } = require("express");
const { toPublicShelf } = require("./serializer");
const { createShelfSchema } = require("./validators");
const { validatedBody, writeAccess } = require("./guards");
const { shelfService } = require("./shelf-service");
const { handleShelfWriteError } = require("./errors");
const listRouter = require("./shelf-list");
const detailRouter = require("./shelf-detail");
const updateRouter = require("./shelf-update");
const removeRouter = require("./shelf-remove");
const sectionsRouter = require("./sections");

const router = Router();

/**
 * @openapi
 * /shelves:
 *   post:
 *     summary: Creates a shelf inside a warehouse; admin and manager_warehouse
 *     description: >
 *       `warehouse_id` and `code` are required. `code` is trimmed, uppercased
 *       and must match `^[A-Za-z0-9_-]{1,50}$`; it is unique inside its
 *       warehouse ignoring case. The response includes an empty `sections`
 *       array.
 *     tags:
 *       - Shelves
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [warehouse_id, code]
 *             properties:
 *               warehouse_id: { type: integer, minimum: 1, example: 1 }
 *               code: { type: string, pattern: '^[A-Za-z0-9_-]{1,50}$', example: A1 }
 *               name: { type: string, maxLength: 100, nullable: true, example: Estante A1 }
 *               description: { type: string, maxLength: 255, nullable: true, example: Pasillo principal }
 *     responses:
 *       201:
 *         description: Shelf created with an empty sections array
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Shelf' }
 *       400:
 *         description: Missing required fields
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorMessage' }
 *             example: { message: warehouse_id and code are required }
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
 *         $ref: '#/components/responses/NotFound'
 *       409:
 *         description: The code already exists in the warehouse
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorMessage' }
 *             example: { message: Shelf already exists }
 *       422:
 *         description: Invalid fields or unknown warehouse
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ValidationErrors' }
 *             example: { errors: { warehouse_id: Invalid warehouse id } }
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post(
  "/",
  ...writeAccess(),
  ...validatedBody(createShelfSchema),
  async (req, res) => {
    try {
      const shelf = await shelfService.createShelf(req.validated);

      return res
        .status(201)
        .json(toPublicShelf(shelf, { includeSections: true }));
    } catch (error) {
      return handleShelfWriteError(error, res);
    }
  },
);

router.use(listRouter);
router.use(detailRouter);
router.use(updateRouter);
router.use(removeRouter);
router.use(sectionsRouter);

module.exports = router;
