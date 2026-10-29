const { Router } = require("express");
const { toPublicShelf } = require("./serializer");
const { readAccess } = require("./guards");
const { shelfService } = require("./shelf-service");
const {
  INCLUDE_MESSAGE,
  WAREHOUSE_ID_MESSAGE,
  parseIncludeSections,
  parseShelfId,
} = require("./validators");

const router = Router();

/**
 * Resolves the listing query. Both filters are validated before querying so a
 * malformed value answers 422 instead of being silently ignored.
 * @param {import("express").Request} req - Express request.
 * @returns {{ warehouseId: number|undefined, includeSections: boolean }|
 *   { errors: Record<string, string> }} The query options or validation errors.
 */
function resolveListQuery(req) {
  const rawWarehouseId = req.query.warehouse_id;
  const includeSections = parseIncludeSections(req.query.include);

  if (includeSections === null) {
    return { errors: { include: INCLUDE_MESSAGE } };
  }

  if (rawWarehouseId === undefined) {
    return { includeSections };
  }

  const warehouseId = parseShelfId(rawWarehouseId);

  if (warehouseId === null) {
    return { errors: { warehouse_id: WAREHOUSE_ID_MESSAGE } };
  }

  return { warehouseId, includeSections };
}

/**
 * @openapi
 * /shelves:
 *   get:
 *     summary: Lists shelves; admin, seller, manager_warehouse and dispatcher
 *     description: >
 *       Returns shelves ordered by `warehouse_id` and then `code`, both
 *       ascending. The optional exact `warehouse_id` filter must be a positive
 *       integer. With `include=sections` every shelf includes its sections
 *       ordered by code, resolved with one Sequelize include (no N+1).
 *     tags:
 *       - Shelves
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: warehouse_id
 *         required: false
 *         schema: { type: integer, minimum: 1 }
 *         example: 1
 *       - in: query
 *         name: include
 *         required: false
 *         schema: { type: string, enum: [sections] }
 *         example: sections
 *     responses:
 *       200:
 *         description: Shelves ordered by warehouse_id and code
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items: { $ref: '#/components/schemas/Shelf' }
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
 *       422:
 *         description: Invalid warehouse_id or include filter
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ValidationErrors' }
 *             example: { errors: { warehouse_id: Invalid warehouse id } }
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get("/", ...readAccess(), async (req, res) => {
  const query = resolveListQuery(req);

  if (query.errors) {
    return res.status(422).json({ errors: query.errors });
  }

  const shelves = await shelfService.listShelves(query);

  return res.json(
    shelves.map((shelf) =>
      toPublicShelf(shelf, {
        includeSections: query.includeSections,
      }),
    ),
  );
});

module.exports = router;
