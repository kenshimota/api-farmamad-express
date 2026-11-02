const { Router } = require("express");
const { writeAccess, validatedBody } = require("./guards");
const { inboxService } = require("./service");
const { toPublicInboxLot } = require("./serializer");
const { handleInboxError } = require("./errors");
const { parseLotId } = require("./parsers");
const { REQUIRED_LOCATION_FIELDS, locationSchema } = require("./validators");

const router = Router();

/**
 * @openapi
 * /warehouse-inbox/lots/{id}/location:
 *   put:
 *     summary: Assigns the warehouse, shelf and section of a lot; admin and manager_warehouse
 *     description: >
 *       Requires `warehouse_id`, `shelf_id` and `section_id`. The lot is locked
 *       with `FOR UPDATE`, the references must exist and the shelf must belong
 *       to the warehouse while the section must belong to the shelf. A pending
 *       or in-progress lot becomes `located` and stores `located_at` and
 *       `located_by`; `location_started_at` and `location_started_by` are kept
 *       as audit. A lot already located or claimed by another user answers
 *       409. The response is 202 with `available = stock - reserved`.
 *     tags:
 *       - Warehouse inbox
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
 *             required: [warehouse_id, shelf_id, section_id]
 *             properties:
 *               warehouse_id: { type: integer, minimum: 1, example: 1 }
 *               shelf_id: { type: integer, minimum: 1, example: 2 }
 *               section_id: { type: integer, minimum: 1, example: 3 }
 *     responses:
 *       202:
 *         description: Located lot
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/WarehouseInboxLot' }
 *       400:
 *         description: Missing location ids
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorMessage' }
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
 *         description: The lot does not exist
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorMessage' }
 *       409:
 *         description: Lot already located or claimed by another user
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorMessage' }
 *       422:
 *         description: Invalid ids, unknown references or incoherent location
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ValidationErrors' }
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.put(
  "/lots/:id/location",
  ...writeAccess(),
  validatedBody(locationSchema, [...REQUIRED_LOCATION_FIELDS]),
  async (req, res) => {
    const id = parseLotId(req.params.id);

    if (id === null) {
      return res.status(422).json({ errors: { id: "Invalid lot id" } });
    }

    try {
      const lot = await inboxService.assignLocation(
        id,
        req.validated,
        req.user.sub,
      );

      return res
        .status(202)
        .json(toPublicInboxLot(lot, { userObjects: false }));
    } catch (error) {
      return handleInboxError(error, res);
    }
  },
);

module.exports = router;
